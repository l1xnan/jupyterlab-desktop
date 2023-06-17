import { useEffect, useState } from "react";
import reactLogo from "./assets/react.svg";
import JupyterLogo from "./assets/jupyterlab-wordmark.svg";
import { invoke } from "@tauri-apps/api/tauri";
import "./App.css";
import { open } from "@tauri-apps/api/dialog";
import { Command } from "@tauri-apps/api/shell";
import { shell } from "@tauri-apps/api";
import { ResponseType, getClient } from "@tauri-apps/api/http";
import { XMLParser } from "fast-xml-parser";

export const SERVER_TOKEN_PREFIX = "jlab:srvr:";

function randomHexString(size: number) {
  const bytes = new Uint8Array(size);
  window.crypto.getRandomValues(bytes);

  return Array.from(bytes)
    .map((i) => ("0" + i.toString(16)).slice(-2))
    .join("");
}

function _generateToken() {
  return SERVER_TOKEN_PREFIX + randomHexString(19);
}

async function jupyter(folder: string) {
  let token = _generateToken();
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

export interface INewsItem {
  title: string;
  link: string;
}

export interface ISessionItem {
  title?: string;
  link: string;
  folder: string;
}

async function getNewsList() {
  const newsFeedUrl = "https://blog.jupyter.org/feed";
  const maxNewsToShow = 10;

  try {
    const response = await fetch(newsFeedUrl);
    const data = await response.text();
    const parser = new XMLParser();
    const feed = parser.parse(data);
    const newsList: INewsItem[] = [];
    for (const item of feed.rss.channel.item) {
      newsList.push({
        title: item.title,
        link: encodeURIComponent(item.link),
      });
      if (newsList.length === maxNewsToShow) {
        break;
      }
    }
    return newsList;
  } catch (error) {
    console.error("Failed to get news list:", error);
  }
}
async function _getNewsList() {
  const newsFeedUrl = "https://blog.jupyter.org/feed";
  const maxNewsToShow = 10;

  try {
    const client = await getClient();
    const response = await client.get(newsFeedUrl, {
      responseType: ResponseType.Text,
    });

    const data: string = response.data as string;
    const parser = new XMLParser();
    const feed = parser.parse(data);
    const newsList: INewsItem[] = [];
    for (const item of feed.rss.channel.item) {
      newsList.push({
        title: item.title,
        link: encodeURIComponent(item.link),
      });
      if (newsList.length === maxNewsToShow) {
        break;
      }
    }
    console.table(newsList);
    return newsList;
  } catch (error) {
    console.error("Failed to get news list:", error);
  }
}

const storage = {
  getItem: (key: string, defaultValue: any = null) => {
    let value = localStorage.getItem(key);
    if (value !== null) {
      return JSON.parse(value);
    }
    return defaultValue;
  },
  setItem: (key: string, value: any) => {
    localStorage.setItem(key, JSON.stringify(value));
  },
};

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");
  const [port, setPort] = useState(0);

  const [session, setSession] = useState<string | null>(null);
  const [newsList, setNewsList] = useState<INewsItem[]>([]);
  const [recentList, setRecentList] = useState<ISessionItem[]>([]);

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
    setGreetMsg(await invoke("greet", { name }));
  }

  useEffect(() => {
    setNewsList(storage.getItem("newsList", []));
    setRecentList(storage.getItem("recentList", []));

    const tmp = async () => {
      const newsList = (await _getNewsList()) ?? [];
      setNewsList(newsList);
      storage.setItem("newsList", newsList);
    };
    tmp();
  }, []);

  const rend = () => {
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
                      let session: string = await invoke("new_session", {
                        folder,
                      });
                      console.log("session:", session);
                      setSession(session as string);
                      let newList: ISessionItem[] = [
                        {
                          link: session,
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

                <a className="action-row">新建会话(New Session...)</a>
                <a className="action-row">新建笔记(New Notebook...)</a>
                <a className="action-row">连接(Connect...)</a>
              </div>
            </div>
            <div>
              <div className="title title-extra">最近(Recent Sessions)</div>

              <div className="row">
                {recentList?.map((item) => {
                  return (
                    <div>
                      <a
                        className="action-row"
                        key={item.folder ?? item.link}
                        onClick={() => {
                          setSession(item.link);
                        }}
                      >
                        {item.title.split(/\\|\//).at(-1)}
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

            <div id="news-list" className="news-list-col">
              {
                // populate news list from cache
                newsList.map((news: INewsItem) => {
                  return (
                    <div className="row" key={news.link}>
                      <a
                        onClick={() => {
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
      {session ? (
        <iframe
          src={session}
          style={{ margin: 0, border: "none", padding: 0, minHeight: "100vh" }}
        ></iframe>
      ) : (
        rend()
      )}
    </div>
  );
}

export default App;
