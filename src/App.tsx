import { useEffect, useRef, useState } from "react";
import JupyterLogo from "./assets/jupyterlab-wordmark.svg";
import "./App.css";
import { invoke } from "@tauri-apps/api";
import {
  createServerEnhance,
  getNewsList,
  getRunningServers,
  INewsItem,
  IServerItem,
} from "./api";
import { storage, uniqueBy } from "./utils";
import * as shell from '@tauri-apps/plugin-shell';
import * as dialog from '@tauri-apps/plugin-dialog';

import { useDisclosure } from "@mantine/hooks";
import { Modal, Button, Group } from "@mantine/core";
import { Input } from "@mantine/core";
import { useForm } from "@mantine/form";
function App() {
  const [server, setServer] = useState<string | null>(null);
  const [newsList, setNewsList] = useState<INewsItem[]>([]);
  const [recentList, setRecentList] = useState<IServerItem[]>([]);
  const [runningServers, setRunningServers] = useState<IServerItem[]>([]);

  const [opened, { open, close }] = useDisclosure(false);
  const form = useForm({
    initialValues: {
      url: "",
    },
    validate: {
      url: (value: string) =>
        /^https?:\/\/.*/.test(value) ? null : "Invalid URL",
    },
  });

  // resolve StrictMode in development render twice question
  const renderRef = useRef(true);

  useEffect(() => {
    console.info("==========");
    console.log("DEV:", import.meta.env.DEV);
    if (import.meta.env.DEV && renderRef.current) {
      renderRef.current = false;
      return;
    }
    (async () => {
      console.info("**********");
      let servers = await getRunningServers();
      console.table(servers);
      setRunningServers(servers);
    })();
  }, []);

  useEffect(() => {
    setNewsList(storage.getItem("newsList", []));

    let recentList = storage.getItem("recentList", []);
    setRecentList(recentList);

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
                    const folder = await dialog.open({
                      directory: true,
                      multiple: false,
                    });
                    console.log(folder);
                    if (typeof folder === "string" && folder) {
                      let server = await createServerEnhance(folder);
                      console.log("server:", server);
                    }
                  }}
                >
                  打开(Open...)
                </a>

                <a className="action-row disabled">新建会话(New Session...)</a>
                <a className="action-row disabled">新建笔记(New Notebook...)</a>
                <a className="action-row " onClick={open}>
                  连接(Connect...)
                </a>
                <Modal opened={opened} onClose={close} title="Connect">
                  <form
                    onSubmit={form.onSubmit(async ({ url }) => {
                      console.log(url);
                      invoke("open_window", { url });
                      close();
                      let recentList = storage.getItem("recentList", []);
                      let newList: IServerItem[] = uniqueBy(
                        [{ link: url }, ...recentList],
                        "folder"
                      );
                      storage.setItem("recentList", newList);
                    })}
                  >
                    <Input
                      placeholder="Your Connect URL"
                      {...form.getInputProps("url")}
                    />
                    <Group position="right">
                      <Button variant="outline" mt="md" size="sm" type="submit">
                        Connect
                      </Button>
                    </Group>
                  </form>
                </Modal>
              </div>
            </div>
            <div>
              <div className="title title-extra">正在运行(Running)</div>

              <div className="row">
                {runningServers?.map((item) => {
                  return (
                    <div key={item?.link ?? item?.folder}>
                      <a
                        className="action-row"
                        onClick={() => {
                          invoke("open_window", { url: item?.link });
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
                        onClick={async () => {
                          if (item.folder) {
                            await createServerEnhance(item.folder);
                          } else {
                            await invoke("open_window", { url: item.link });
                          }
                        }}
                      >
                        {item?.title?.split(/\\|\//).at(-1) ??
                          new URL(item.link).origin}
                      </a>
                      <span style={{ marginLeft: 8 }}>{item.folder}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="right">
            <News newsList={newsList} />
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

function News({ newsList }: { newsList: INewsItem[] }) {
  return (
    <>
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
    </>
  );
}

export default App;
