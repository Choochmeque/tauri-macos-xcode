export interface TauriConfig {
  productName?: string;
  identifier?: string;
  version?: string;
  bundle?: {
    identifier?: string;
  };
  build?: {
    beforeDevCommand?: string;
  };
}

export interface AppInfo {
  productName: string;
  identifier: string;
  bundleIdPrefix: string;
  version: string;
  macosDeploymentTarget: string;
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
