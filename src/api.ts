import { invoke } from "@tauri-apps/api";
import { ResponseType, getClient } from "@tauri-apps/api/http";
import { Command } from "@tauri-apps/api/shell";
import { XMLParser } from "fast-xml-parser";
import { storage, uniqueBy } from "./utils";

export interface IServerItem {
  title?: string;
  link: string;
  folder: string;
}

export async function greet(name: string) {
  // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
  return await invoke("greet", { name });
}

export async function getRunningServers(): Promise<IServerItem[]> {
  return await invoke("get_running_servers");
}

export async function createServer(folder: string): Promise<string> {
  return await invoke("create_server", { folder });
}

export async function createServerEnhance(folder: string) {
  let server = await createServer(folder);
  console.log("server:", server);
  let item = {
    link: "",
    folder,
    title: folder.split(/\\|\//).at(-1),
  };

  let recentList = storage.getItem("recentList", []);
  let newList: IServerItem[] = uniqueBy([item, ...recentList], "folder");
  localStorage.setItem("recentList", JSON.stringify(newList));
  return server;
}

export interface INewsItem {
  title: string;
  link: string;
}

async function _getNewsList() {
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
export async function getNewsList() {
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
        link: item.link,
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

export async function checkServer(server: IServerItem) {
  try {
    const res = await fetch(server?.link);
    return res.status === 200;
  } catch (error) {
    console.error(`${server?.link}:`, error);
  } finally {
    return false;
  }
}
