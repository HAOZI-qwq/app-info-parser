/**
 * app-info-parser-next - Parse APK, IPA and zipped .app bundles
 *
 * @example
 * ```typescript
 * import AppInfoParser = require('app-info-parser-next')
 *
 * const parser = new AppInfoParser('/path/to/app.apk')
 * const info = await parser.parse()
 * console.log(info.package, info.versionName, info.abis)
 * ```
 */
declare class AppInfoParser {
    /** Node file path or a browser File/Blob-like object */
    constructor(file: string | AppInfoParser.FileLike);

    /** Parse the package and return its metadata */
    parse(): Promise<AppInfoParser.AppInfo>;
}

declare namespace AppInfoParser {
    /**
     * Structural browser input type so Node-only TypeScript projects do not
     * need to include the DOM lib just to consume this package's definitions.
     * Browser File and Blob objects satisfy this shape.
     */
    export interface FileLike {
        size: number;
        name?: string;
        [key: string]: any;
    }

    export interface AdaptiveIcons {
        background?: string;
        foreground?: string;
        monochrome?: string;
    }

    export interface ResourceConfiguration {
        locale: string;
        language: string;
        region: string;
        mcc: number;
        mnc: number;
        orientation: number;
        touchscreen: number;
        density: number;
        densityQualifier: string;
        keyboard: number;
        navigation: number;
        inputFlags: number;
        screenWidth: number;
        screenHeight: number;
        sdkVersion: number;
        minorVersion: number;
        screenLayout: number;
        uiMode: number;
        smallestScreenWidthDp: number;
        screenWidthDp: number;
        screenHeightDp: number;
    }

    export interface ResourceConfigSummary {
        locales: string[];
        densities: string[];
        sdkVersions: number[];
        configurations: ResourceConfiguration[];
    }

    export interface ApplicationInfo {
        /** App display label, possibly with multiple resource variants */
        label?: string | string[];

        /** Manifest icon resource/path, possibly with multiple variants */
        icon?: string | string[];

        [key: string]: any;
    }

    /** Common result shape. Platform-specific fields are also preserved. */
    export interface AppInfo {
        /** Android package name */
        package?: string;

        /** Android numeric version code */
        versionCode?: number;

        /** Android human-readable version */
        versionName?: string;

        /** Android manifest application node */
        application?: ApplicationInfo;

        /** Browser-renderable Data URI (raster image or SVG) */
        icon?: string | null;

        /** Resource path used to produce icon */
        iconPath?: string | null;

        /** Adaptive Icon layers when an adaptive launcher icon was resolved */
        adaptiveIcons?: AdaptiveIcons | null;

        /** Native ABIs found under lib/<abi>/*.so in APKs */
        abis?: string[];

        /** Summary of Android ResTable_config variants */
        resourceConfigs?: ResourceConfigSummary;

        /** Parsed iOS embedded.mobileprovision plist */
        mobileProvision?: Record<string, any>;

        /** iOS bundle identifier */
        CFBundleIdentifier?: string;

        /** iOS user-visible version */
        CFBundleShortVersionString?: string;

        /** iOS build version */
        CFBundleVersion?: string;

        /** Additional manifest/plist fields are preserved */
        [key: string]: any;
    }
}

export = AppInfoParser;
