import { validateWorkspacePath } from "../../safety/pathGuard.js";
import { fetchHttpGet } from "../../utils/httpFetch.js";
import { fail, partial } from "../../utils/result.js";
import { marketplaceUrl, readExtensionPackageJson } from "./vsixUtils.js";

export interface VsixVerifyPublishInput {
  workspacePath?: string;
  publisher?: string;
  name?: string;
  expectedVersion?: string;
}

export async function vsixVerifyPublish(input: VsixVerifyPublishInput) {
  let publisher = input.publisher?.trim();
  let name = input.name?.trim();
  let expectedVersion = input.expectedVersion?.trim();

  if (input.workspacePath?.trim()) {
    const validation = validateWorkspacePath(input.workspacePath);
    if (!validation.ok) return fail(validation.error ?? "Invalid workspace");

    const pkg = readExtensionPackageJson(validation.resolvedPath!);
    if (!pkg.ok || !pkg.data) return fail(pkg.error ?? "package.json missing");
    publisher = publisher ?? pkg.data.publisher?.trim();
    name = name ?? pkg.data.name?.trim();
    expectedVersion = expectedVersion ?? pkg.data.version?.trim();
  }

  if (!publisher || !name) {
    return fail("publisher and name required (via workspacePath or explicit fields)");
  }

  const extensionId = `${publisher}.${name}`;
  const url = marketplaceUrl(publisher, name);

  try {
    const res = await fetchHttpGet(url, { timeoutMs: 20_000, maxBodyChars: 32_000 });
    const body = res.body ?? "";
    const found =
      res.httpStatus >= 200 &&
      res.httpStatus < 400 &&
      (body.includes(extensionId) ||
        body.includes(`"${publisher}.${name}"`) ||
        body.includes(publisher));

    if (!found) {
      return fail(`Extension not found on marketplace (HTTP ${res.httpStatus})`, {
        marketplaceUrl: url,
        extensionId,
        found: false,
        httpStatus: res.httpStatus,
      });
    }

    let versionMatched: boolean | null = null;
    if (expectedVersion) {
      const verPattern = new RegExp(`"version"\\s*:\\s*"${expectedVersion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`);
      versionMatched = verPattern.test(body) || body.includes(expectedVersion);
    }

    const payload = {
      marketplaceUrl: url,
      extensionId,
      found: true,
      expectedVersion: expectedVersion ?? null,
      versionMatched,
      httpStatus: res.httpStatus,
    };

    if (expectedVersion && versionMatched === false) {
      return partial({ ...payload, hint: "Extension found but version match inconclusive from public page" });
    }
    if (expectedVersion && versionMatched === null) {
      return partial({ ...payload, hint: "Could not verify version from marketplace HTML" });
    }

    return { status: "PASS" as const, ...payload };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(`Marketplace verify failed: ${message}`, {
      marketplaceUrl: url,
      extensionId,
      found: false,
    });
  }
}
