export interface TauriConfig {
  productName?: string;
  identifier?: string;
  version?: string;
  bundle?: {
    identifier?: string;
    category?: string;
    copyright?: string;
    resources?: string[] | Record<string, string>;
    fileAssociations?: FileAssociation[];
    macOS?: {
      minimumSystemVersion?: string;
      files?: Record<string, string>;
      frameworks?: string[];
    };
  };
  build?: {
    beforeDevCommand?: string;
  };
}

export interface ResourceMapping {
  source: string;
  target: string;
}

// File association types matching Tauri's schema
export type BundleTypeRole =
  | "Editor"
  | "Viewer"
  | "Shell"
  | "QLGenerator"
  | "None";
export type HandlerRank = "Default" | "Owner" | "Alternate" | "None";

export interface ExportedFileAssociation {
  identifier: string;
  conformsTo?: string[];
}

export interface FileAssociation {
  ext: string[];
  name?: string;
  role?: BundleTypeRole;
  contentTypes?: string[];
  rank?: HandlerRank;
  exportedType?: ExportedFileAssociation;
}

export interface AppInfo {
  productName: string;
  identifier: string;
  bundleIdPrefix: string;
  version: string;
  macosDeploymentTarget: string;
  category?: string;
  copyright?: string;
  files?: Record<string, string>;
  frameworks?: string[];
  resources?: ResourceMapping[];
  fileAssociations?: FileAssociation[];
}

export interface InitOptions {
  path?: string;
}

export interface DevOptions {
  open?: boolean;
  path?: string;
}

export interface TemplateVars {
  PRODUCT_NAME: string;
  BUNDLE_IDENTIFIER: string;
  BUNDLE_ID_PREFIX: string;
  VERSION: string;
  MACOS_DEPLOYMENT_TARGET: string;
  [key: string]: string;
}
