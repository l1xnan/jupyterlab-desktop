import { useEffect, useRef, useState } from "react";
import JupyterLogo from "./assets/jupyterlab-wordmark.svg";
import "./App.css";
import { dialog } from "@tauri-apps/api";
import { invoke, shell } from "@tauri-apps/api";
import {
  createServerEnhance,
  getNewsList,
  getRunningServers,
  INewsItem,
  IServerItem,
} from "./api";
import { storage } from "./utils";
import { WebviewWindow } from "@tauri-apps/api/window";
import { useDisclosure } from "@mantine/hooks";
import {
  Modal,
  Button,
  Group,
  Box,
  Title,
  NavLink,
  Flex,
  Grid,
  Image,
} from "@mantine/core";
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
      email: "",
      termsOfService: false,
    },

    validate: {
      url: (value: any) => (/^\S+@\S+$/.test(value) ? null : "Invalid email"),
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
        <Image
          maw={360}
          mx="auto"
          radius="md"
          src={JupyterLogo}
          alt="JupyterLab logo"
          style={{
            paddingTop: "10%",
            marginLeft: 0,
          }}
        />

        <div className="welcome-content">
          <Grid columns={24}>
            <Grid.Col className="left" span={12}>
              <div>
                <Title order={4}>启动(Start)</Title>
                <div className="row">
                  <NavLink
                    // className="action-row"
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
                    label="打开(Open...)"
                    style={{ marginLeft: 0 }}
                  />

                  <NavLink label="新建会话(New Session...)" />
                  <NavLink label="新建笔记(New Notebook...)" />
                  <NavLink label="连接(Connect...)" onClick={open} />

                  <Modal opened={opened} onClose={close} title="Connect">
                    <form
                      onSubmit={form.onSubmit((values) => console.log(values))}
                    >
                      <Input
                        placeholder="Your Connect URL"
                        {...form.getInputProps("email")}
                      />
                      <Group position="right">
                        <Button variant="outline" mt="md" onClick={close}>
                          Connect
                        </Button>
                      </Group>
                    </form>
                  </Modal>
                </div>
              </div>
              <div>
                <Title order={4}>正在运行(Running)</Title>

                <div className="row">
                  {runningServers?.map((item) => {
                    return (
                      <NavLink
                        key={item?.link ?? item?.folder}
                        className="action-row"
                        onClick={() => {
                          invoke("open_window", { url: item?.link });
                        }}
                        label={
                          <span>
                            <span>{item?.title}</span>
                            <span style={{ marginLeft: 8 }}>{item.folder}</span>
                          </span>
                        }
                      />
                    );
                  })}
                </div>
              </div>
              <div>
                <Title order={4}>最近(Recent Sessions)</Title>

                <div className="row">
                  {recentList?.map((item) => {
                    return (
                      <div key={item.folder}>
                        <NavLink
                          onClick={async () => {
                            await createServerEnhance(item.folder);
                          }}
                          label={
                            <span>
                              <span>{item?.title?.split(/\\|\//).at(-1)}</span>
                              <span style={{ marginLeft: 8 }}>
                                {item.folder}
                              </span>
                            </span>
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </Grid.Col>
            <Grid.Col className="right" span={12}>
              <News newsList={newsList} />
            </Grid.Col>
          </Grid>
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
