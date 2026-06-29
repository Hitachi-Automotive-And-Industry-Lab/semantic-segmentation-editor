import {isAbsolute, relative, resolve} from "path";

export function resolveInside(baseFolder, requestPath, suffix = "") {
    const basePath = resolve(baseFolder);
    const pathWithoutQuery = (requestPath || "").split(/[?#]/)[0];
    const decodedPath = decodeURIComponent(pathWithoutQuery);
    const relativePath = decodedPath.replace(/^\/+/, "");
    const targetPath = resolve(basePath, relativePath + suffix);
    const relativeToBase = relative(basePath, targetPath);

    if (relativeToBase && (relativeToBase.startsWith("..") || isAbsolute(relativeToBase))) {
        throw new Error("Path is outside the configured data folder.");
    }

    return targetPath;
}
