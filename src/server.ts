import { fs, path } from "@tauri-apps/api";

export const serverLaunchArgsFixed = [
  "--no-browser",
  "--expose-app-in-browser",
  `--ServerApp.port={port}`,
  // use our token rather than any pre-configured password
  '--ServerApp.password=""',
  `--ServerApp.token="{token}"`,
  "--LabApp.quit_button=False",
];

export const serverLaunchArgsDefault = [
  // do not use any config file
  '--JupyterApp.config_file_name=""',
  // enable hidden files (let user decide whether to display them)
  "--ContentsManager.allow_hidden=True",
];

/**
 * Different types of environments
 */
export enum IEnvironmentType {
  /**
   * This is the catch-all type value, any environments that are randomly found or
   * entered will have this type
   */
  Path = "path",
  /**
   * This environment type is reserved for the type level of conda installations
   */
  CondaRoot = "conda-root",
  /**
   * This environment type is reserved for sub environments of a conda installation
   */
  CondaEnv = "conda-env",
  /**
   * This environment type is for environments that were derived from the WindowsRegistry
   */
  WindowsReg = "windows-reg",
  VirtualEnv = "venv",
}

export const EnvironmentTypeName: { [key in IEnvironmentType]: string } = {
  [IEnvironmentType.Path]: "system",
  [IEnvironmentType.CondaRoot]: "conda",
  [IEnvironmentType.CondaEnv]: "conda",
  [IEnvironmentType.WindowsReg]: "win",
  [IEnvironmentType.VirtualEnv]: "venv",
};

/**
 * Dictionary that contains all requirement names mapped to version number strings
 */
export interface IVersionContainer {
  [name: string]: string;
}

/**
 * The representation of the python environment
 */
export interface IPythonEnvironment {
  /**
   * The file path of the python executable
   */
  path: string;
  /**
   * Arbitrary name used for display, not guaranteed to be unique
   */
  name: string;
  /**
   * The type of the environment
   */
  type: IEnvironmentType;
  /**
   * For each requirement specified by the registry, there will be one corresponding version
   * There will also be a version that accompanies the python executable
   */
  versions: IVersionContainer;
  /**
   * Default kernel name
   */
  defaultKernel: string;
}
export type KeyValueMap = { [key: string]: string };

export namespace JupyterServer {
  export interface IOptions {
    port?: number;
    token?: string;
    workingDirectory?: string;
    environment?: IPythonEnvironment;
  }

  export interface IInfo {
    type: "local" | "remote";
    url: URL;
    port: number;
    token: string;
    environment: IPythonEnvironment;
    workingDirectory: string;
    serverArgs: string;
    overrideDefaultServerArgs: boolean;
    serverEnvVars: KeyValueMap;
    version?: string;
    pageConfig?: any;
  }
}

export async function getEnvironmentPath(environment: IPythonEnvironment): Promise<string> {
  const isWin = process.platform === "win32";
  const pythonPath = environment.path;
  let envPath = await path.dirname(pythonPath);
  if (!isWin) {
    envPath = await path.normalize(await path.join(envPath, "../"));
  }

  return envPath;
}

async function createLaunchScript(
  serverInfo: JupyterServer.IInfo,
  baseCondaPath: string,
  schemasDir: string,
  port: number,
  token: string
): Promise<string> {
  const isWin = process.platform === "win32";
  const envPath = getEnvironmentPath(serverInfo.environment);

  // note: traitlets<5.0 require fully specified arguments to
  // be followed by equals sign without a space; this can be
  // removed once jupyter_server requires traitlets>5.0
  const launchArgs = ["python", "-m", "jupyterlab"];

  const strPort = port.toString();

  for (const arg of serverLaunchArgsFixed) {
    launchArgs.push(arg.replace("{port}", strPort).replace("{token}", token));
  }

  if (!serverInfo.overrideDefaultServerArgs) {
    for (const arg of serverLaunchArgsDefault) {
      launchArgs.push(arg);
    }
  }

  let launchCmd = launchArgs.join(" ");

  if (serverInfo.serverArgs) {
    launchCmd += ` ${serverInfo.serverArgs}`;
  }

  let script: string;
  const isConda =
    serverInfo.environment.type === IEnvironmentType.CondaRoot ||
    serverInfo.environment.type === IEnvironmentType.CondaEnv;

  if (isWin) {
    if (isConda) {
      script = `
        CALL ${baseCondaPath}\\condabin\\activate.bat
        CALL conda activate ${envPath}
        CALL ${launchCmd}`;
    } else {
      script = `
        CALL ${envPath}\\activate.bat
        CALL ${launchCmd}`;
    }
  } else {
    if (isConda) {
      script = `
        source "${baseCondaPath}/bin/activate"
        conda activate "${envPath}"
        ${launchCmd}`;
    } else {
      script = `
        source "${envPath}/bin/activate"
        ${launchCmd}`;
    }
  }

  const ext = isWin ? "bat" : "sh";
  const scriptPath = createTempFile(`launch.${ext}`, script);

  console.debug(`Server launch script:\n${script}`);

  // if (!isWin) {
  //   fs.chmodSync(scriptPath, 0o755);
  // }

  return scriptPath;
}

async function  createTempFile(
  fileName = 'temp',
  data = '',
  encoding: BufferEncoding = 'utf8'
) {
  const tempDirPath = await path.join("/tmp", 'jlab_desktop');
  const tmpFilePath =  await path.join(tempDirPath, fileName);

  fs.writeFile(tmpFilePath, data);

  return tmpFilePath;
}