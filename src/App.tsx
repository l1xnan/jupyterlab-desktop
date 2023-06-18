import { useEffect, useState } from "react";
import JupyterLogo from "./assets/jupyterlab-wordmark.svg";
import { invoke } from "@tauri-apps/api/tauri";
import "./App.css";
import { open } from "@tauri-apps/api/dialog";
import { Command } from "@tauri-apps/api/shell";
import { shell } from "@tauri-apps/api";
import {
  createServer,
  getNewsList,
  getRunningServers,
  INewsItem,
  IServerItem,
} from "./api";
import { storage, generateToken } from "./utils";

async function jupyter(folder: string) {
  let token = generateToken();
  let port = await invoke("get_free_port");
  let serverLaunchArgsFixed = [
    "--no-browser",
    "--expose-app-in-browser",
    `--ServerApp.port=${port}`,
    // use our token rather than any pre-configured password
    '--ServerApp.password=""',
    `--ServerApp.token="${token}"`,
    "--LabApp.quit_button=False",
    `--ServerApp.tornado_settings={'headers': {'Content-Security-Policy': 'frame-ancestors *'}}`,
    "--ServerApp.allow_origin=*",
    "--ServerApp.allow_credentials=True",
    `--ServerApp.root_dir=${folder}`,
  ];

  let args = [
    // "-m",
    // "jupyterlab",
    "lab",
    ...serverLaunchArgsFixed,
  ];

  console.log(args.join(" "));

  let command = new Command("jupyter", args);
  command.stderr.on("data", (line) => {
    console.error("line err:", line);
  });
  command.stdout.on("data", (line) => {
    console.info("line out:", line);
  });
  command.on("close", (line) => {
    console.log("close:", line);
  });
  command.on("error", (line) => {
    console.log("error:", line);
  });
  try {
    let child = await command.spawn();
    console.log(child);
  } catch (error) {
    console.log(error);
  } finally {
    let url = `http://localhost:${port}/lab?token=${token}`;
    return url;
  }
}

async function checkServer(server: IServerItem) {
  try {
    const res = await fetch(server?.link);
    return res.status === 200;
  } catch (error) {
    console.error(`${server?.link}:`, error);
  } finally {
    return false;
  }
}

function App() {
  const [port, setPort] = useState(0);

  const [server, setServer] = useState<string | null>(null);
  const [newsList, setNewsList] = useState<INewsItem[]>([]);
  const [recentList, setRecentList] = useState<IServerItem[]>([]);
  const [runningServers, setRunningServers] = useState<IServerItem[]>([]);

  useEffect(() => {
    (async () => {
      let servers = await getRunningServers();
      console.table(servers);
      for (let server of servers) {
        const status = await checkServer(server);
        console.log(status);
      }
      setRunningServers(servers);
    })();
  }, []);

  useEffect(() => {
    setNewsList(storage.getItem("newsList", []));
    setRecentList(storage.getItem("recentList", []));

    const tmp = async () => {
      const newsList = (await getNewsList()) ?? [];
      setNewsList(newsList);
      storage.setItem("newsList", newsList);
    };
    tmp();
  }, []);

  const Welcome = () => {
    return (
      <div className="welcome">
        <img
          src={JupyterLogo}
          className="welcome-logo "
          alt="JupyterLab logo"
        />

        <div className="welcome-content">
          <div className="left">
            <div className="">
              <div className="title">启动(Start)</div>
              <div className="row">
                <a
                  className="action-row"
                  onClick={async () => {
                    const folder = await open({
                      directory: true,
                      multiple: false,
                    });
                    console.log(folder);
                    if (typeof folder === "string" && folder) {
                      let server = await createServer(folder);
                      console.log("server:", server);
                      setServer(server as string);
                      let newList: IServerItem[] = [
                        {
                          link: server,
                          folder,
                          title: folder.split(/\\|\//).at(-1),
                        },
                        ...(recentList ?? []),
                      ];
                      setRecentList(newList);
                      localStorage.setItem(
                        "recentList",
                        JSON.stringify(newList)
                      );
                    }
                  }}
                >
                  打开(Open...)
                </a>

                <a className="action-row disabled">新建会话(New Session...)</a>
                <a className="action-row disabled">新建笔记(New Notebook...)</a>
                <a className="action-row disabled">连接(Connect...)</a>
              </div>
            </div>
            <div>
              <div className="title title-extra">正在运行(Running)</div>

              <div className="row">
                {runningServers?.map((item) => {
                  return (
                    <div key={item.folder ?? item.link}>
                      <a
                        className="action-row"
                        onClick={() => {
                          setServer(item.link);
                        }}
                      >
                        {item?.title}
                      </a>
                      <span style={{ marginLeft: 8 }}>{item.folder}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="title title-extra">最近(Recent Sessions)</div>

              <div className="row">
                {recentList?.map((item) => {
                  return (
                    <div key={item.folder ?? item.link}>
                      <a
                        className="action-row"
                        onClick={() => {
                          setServer(item.link);
                        }}
                      >
                        {item?.title?.split(/\\|\//).at(-1)}
                      </a>
                      <span style={{ marginLeft: 8 }}>{item.folder}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="right">
            <div className="row row-title title">Jupyter News</div>

            <div id="news-list" className="news-list-col action-row more-row">
              {
                // populate news list from cache
                newsList.map((news: INewsItem) => {
                  return (
                    <div className="row" key={news.link}>
                      <a
                        onClick={async () => {
                          shell.open(news.link);
                        }}
                      >
                        {news.title}
                      </a>
                    </div>
                  );
                })
              }
            </div>

            <div className="row action-row more-row news-col-footer">
              <a
                onClick={async () => {
                  shell.open("https://blog.jupyter.org");
                }}
              >
                Jupyter Blog
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="container">
      {server ? (
        <iframe
          src={server}
          style={{ margin: 0, border: "none", padding: 0, minHeight: "100vh" }}
        ></iframe>
      ) : (
        Welcome()
      )}
    </div>
  );
}

export default App;
