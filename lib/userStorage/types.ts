export type ProviderKind = "cloud" | "local" | "gdrive" | "nextcloud" | "s3" | "webdav";

export type Progress = (done: number, total: number) => void;

export interface RemoteRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
}

export interface StoredFile {
  path: string;
  size: number;
}

export interface StorageProvider {
  kind: ProviderKind;
  label: string;
  remote: boolean;
  put(path: string, data: Blob, onProgress?: Progress): Promise<void>;
  get(path: string, onProgress?: Progress): Promise<Blob | null>;
  remove(path: string): Promise<void>;
  list(prefix: string): Promise<StoredFile[]>;
  remoteRead?(path: string): Promise<RemoteRequest>;
  remoteWrite?(path: string): Promise<RemoteRequest>;
}

export interface S3Config {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  prefix: string;
}

export interface WebdavConfig {
  url: string;
  username: string;
  password: string;
}

export interface NextcloudConfig {
  kind: "nextcloud";
  server: string;
  loginName: string;
  token: string;
  webdavUrl: string;
  expires: number;
}

export type StorageConfig =
  | { kind: "cloud" }
  | { kind: "local" }
  | { kind: "gdrive" }
  | NextcloudConfig
  | ({ kind: "s3" } & S3Config)
  | ({ kind: "webdav" } & WebdavConfig);

export const PROVIDER_LABEL: Record<ProviderKind, string> = {
  cloud: "Challengemon-Cloud",
  local: "Nur dieses Gerät",
  gdrive: "Google Drive",
  nextcloud: "Nextcloud",
  s3: "S3-kompatibel",
  webdav: "WebDAV",
};

export const ROOT = "Challengemon";
