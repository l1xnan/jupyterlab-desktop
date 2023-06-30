export const storage = {
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

export function randomHexString(size: number) {
  const bytes = new Uint8Array(size);
  window.crypto.getRandomValues(bytes);

  return Array.from(bytes)
    .map((i) => ("0" + i.toString(16)).slice(-2))
    .join("");
}

export const SERVER_TOKEN_PREFIX = "jlab:srvr:";

// 生成 token
export function generateToken() {
  return SERVER_TOKEN_PREFIX + randomHexString(19);
}


export function uniqueBy(arr: any[], key: string) {
  let map = new Set();
  let temp = [];
  for (let item of arr) {
    if (!map.has(item[key])) {
      //如果键值不存在，则写入这个键值并添加到数组
      map.add(item[key]);
      temp.push(item);
    }
  }
  return temp;
}