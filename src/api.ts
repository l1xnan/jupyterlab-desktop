import { invoke } from "@tauri-apps/api";
import { ResponseType, getClient } from "@tauri-apps/api/http";
import { XMLParser } from "fast-xml-parser";

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
