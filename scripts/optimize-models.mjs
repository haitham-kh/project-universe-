#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";
import sharp from "sharp";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";

const root = process.cwd();
let tempDir = "";
const gltfTransformCli = resolve(root, "node_modules/@gltf-transform/cli/bin/cli.js");
const ktxBinDir =
  process.platform === "win32"
    ? resolve(root, "node_modules/ktx2tools/bin/windows")
    : resolve(root, "node_modules/ktx2tools/bin/linux");
const basePathValue = process.env.Path || process.env.PATH || "";
const mergedPathValue = `${ktxBinDir}${delimiter}${basePathValue}`;

const pipelineEnv = {
  ...process.env,
  PATH: mergedPathValue,
  Path: mergedPathValue,
  CI: process.env.CI || "1",
};
const skipKTX = process.env.ASSETS_SKIP_KTX === "1";
const includeIds = new Set(
  (process.env.ASSETS_INCLUDE_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
);
const ENCODER_ETC1S = "etc1s";
const ENCODER_UASTC = "uastc";

const MODELS = [
  {
    id: "scene1_background",
    source: "public/models/new backgeound/source/latestv5.glb",
    desktop: "public/models/optimized/latestv5.ktx2.glb",
    desktopEncoder: ENCODER_UASTC,
    desktopUastcLevel: 4,
    desktopUastcRdo: true,
    desktopUastcRdoLambda: 0.25,
  },
  {
    id: "scene1_hero_ship",
    source: "public/models/ship.glb",
    desktop: "public/models/optimized/ship.ktx2.glb",
    mobile: "public/models/optimized/ship.mobile.ktx2.glb",
    mobileMaxSize: 1024,
    desktopEncoder: ENCODER_UASTC,
    desktopUastcLevel: 3,
    desktopUastcRdo: true,
    desktopUastcRdoLambda: 0.4,
    mobileEncoder: ENCODER_UASTC,
    mobileUastcLevel: 2,
    mobileUastcRdo: true,
    mobileUastcRdoLambda: 0.55,
  },
  {
    id: "scene2_starback",
    source: "public/models/starback.glb",
    desktop: "public/models/optimized/starback.ktx2.glb",
    desktopEncoder: ENCODER_UASTC,
    desktopUastcLevel: 4,
    desktopUastcRdo: true,
    desktopUastcRdoLambda: 0.25,
  },
  {
    id: "scene2_saturn",
    source: "public/models/saturn2.glb",
    desktop: "public/models/optimized/saturn2.ktx2.glb",
    mobile: "public/models/optimized/saturn2.mobile.ktx2.glb",
    mobileMaxSize: 1024,
    desktopEncoder: ENCODER_UASTC,
    desktopUastcLevel: 4,
    desktopUastcRdo: true,
    desktopUastcRdoLambda: 0.25,
    mobileEncoder: ENCODER_UASTC,
    mobileUastcLevel: 3,
    mobileUastcRdo: true,
    mobileUastcRdoLambda: 0.4,
  },
  {
    id: "scene3_neptune",
    source: "public/models/neptune-v3-draco.glb",
    desktop: "public/models/optimized/neptune-v3.ktx2.glb",
    mobile: "public/models/optimized/neptune-v3.mobile.ktx2.glb",
    mobileMaxSize: 1024,
    desktopEncoder: ENCODER_UASTC,
    desktopUastcLevel: 3,
    desktopUastcRdo: true,
    desktopUastcRdoLambda: 0.35,
    mobileEncoder: ENCODER_UASTC,
    mobileUastcLevel: 2,
    mobileUastcRdo: true,
    mobileUastcRdoLambda: 0.55,
  },
  {
    id: "scene3_neptune_limb",
    source: "public/models/neptuenlimp-draco.glb",
    desktop: "public/models/optimized/neptuenlimp.ktx2.glb",
    mobile: "public/models/optimized/neptuenlimp.mobile.ktx2.glb",
    mobileMaxSize: 1024,
    desktopEncoder: ENCODER_UASTC,
    desktopUastcLevel: 4,
    desktopUastcRdo: true,
    desktopUastcRdoLambda: 0.25,
    mobileEncoder: ENCODER_UASTC,
    mobileUastcLevel: 3,
    mobileUastcRdo: true,
    mobileUastcRdoLambda: 0.4,
  },
];

let sharedNodeIO = null;

function runGLTFTransform(args) {
  const commandLabel = `${process.execPath} ${gltfTransformCli} ${args.join(" ")}`;
  console.log(`[optimize-models] ${commandLabel}`);
  const result = spawnSync(process.execPath, [gltfTransformCli, ...args], {
    stdio: "inherit",
    env: pipelineEnv,
  });

  if (result.status !== 0 || result.error) {
    throw new Error(
      `gltf-transform command failed with exit code ${result.status}: ${result.error?.message || "unknown error"}\n${commandLabel}`,
    );
  }
}

function ensureParent(pathLike) {
  mkdirSync(dirname(pathLike), { recursive: true });
}

function toMB(bytes) {
  return Number((bytes / (1024 * 1024)).toFixed(3));
}

function readGLBJSON(glbPath) {
  const buffer = readFileSync(glbPath);
  const jsonChunkLength = buffer.readUInt32LE(12);
  const jsonChunkType = buffer.readUInt32LE(16);
  if (jsonChunkType !== 0x4e4f534a) {
    return null;
  }
  return JSON.parse(buffer.slice(20, 20 + jsonChunkLength).toString("utf8"));
}

function glbHasWebPTextures(glbPath) {
  const doc = readGLBJSON(glbPath);
  if (!doc) return false;
  return (doc.images || []).some((image) => image?.mimeType === "image/webp");
}

function glbHasDracoCompression(glbPath) {
  const doc = readGLBJSON(glbPath);
  if (!doc) return false;
  return (doc.extensionsUsed || []).includes("KHR_draco_mesh_compression");
}

async function getNodeIO() {
  if (sharedNodeIO) return sharedNodeIO;

  sharedNodeIO = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      "draco3d.decoder": await draco3d.createDecoderModule(),
      "draco3d.encoder": await draco3d.createEncoderModule(),
    });

  return sharedNodeIO;
}

async function convertEmbeddedWebPToPNG(inputAbs, outputAbs) {
  const io = await getNodeIO();
  const doc = await io.read(inputAbs);
  let converted = 0;

  for (const texture of doc.getRoot().listTextures()) {
    if (texture.getMimeType() !== "image/webp") continue;

    const image = texture.getImage();
    if (!image) continue;

    const png = await sharp(Buffer.from(image))
      .png({ compressionLevel: 9 })
      .toBuffer();

    texture.setImage(new Uint8Array(png));
    texture.setMimeType("image/png");
    const uri = texture.getURI();
    if (uri) texture.setURI(uri.replace(/\.webp$/i, ".png"));
    converted++;
  }

  await io.write(outputAbs, doc);
  console.log(
    `[optimize-models] Converted ${converted} embedded WebP texture(s): ${inputAbs} -> ${outputAbs}`,
  );
}

async function prepareForKTX2(inputAbs, tempLabel) {
  if (!glbHasWebPTextures(inputAbs)) {
    return inputAbs;
  }

  const pngConvertedAbs = resolve(tempDir, `${tempLabel}.png-source.glb`);
  await convertEmbeddedWebPToPNG(inputAbs, pngConvertedAbs);
  return pngConvertedAbs;
}

function getVariantEncoder(model, variant) {
  if (variant === "desktop") return model.desktopEncoder || ENCODER_ETC1S;
  return model.mobileEncoder || model.desktopEncoder || ENCODER_ETC1S;
}

function runTextureEncode(model, variant, sourceAbs, outputAbs) {
  const encoder = getVariantEncoder(model, variant);
  const jobs = "8";

  if (encoder === ENCODER_UASTC) {
    const level =
      variant === "desktop"
        ? model.desktopUastcLevel ?? 3
        : model.mobileUastcLevel ?? model.desktopUastcLevel ?? 2;
    const zstd =
      variant === "desktop"
        ? model.desktopUastcZstd ?? 18
        : model.mobileUastcZstd ?? model.desktopUastcZstd ?? 18;
    const rdoEnabled =
      variant === "desktop"
        ? model.desktopUastcRdo ?? true
        : model.mobileUastcRdo ?? model.desktopUastcRdo ?? true;
    const rdoLambda =
      variant === "desktop"
        ? model.desktopUastcRdoLambda ?? 1
        : model.mobileUastcRdoLambda ?? model.desktopUastcRdoLambda ?? 1;

    const args = [
      ENCODER_UASTC,
      sourceAbs,
      outputAbs,
      "--level",
      String(level),
      "--zstd",
      String(zstd),
      "--jobs",
      jobs,
    ];

    if (rdoEnabled) {
      args.push("--rdo", "--rdo-lambda", String(rdoLambda));
    }

    console.log(
      `[optimize-models] ${model.id} (${variant}) texture encode: uastc level=${level}, rdo=${rdoEnabled}, lambda=${rdoLambda}, zstd=${zstd}`,
    );
    runGLTFTransform(args);
    return;
  }

  const quality =
    variant === "desktop" ? model.desktopQuality ?? 180 : model.mobileQuality ?? 128;
  const compression =
    variant === "desktop"
      ? model.desktopCompression ?? 2
      : model.mobileCompression ?? 3;
  const rdoThreshold =
    variant === "desktop"
      ? model.desktopRdoThreshold ?? 1.25
      : model.mobileRdoThreshold ?? 1.6;

  console.log(
    `[optimize-models] ${model.id} (${variant}) texture encode: etc1s quality=${quality}, compression=${compression}, rdoThreshold=${rdoThreshold}`,
  );
  runGLTFTransform([
    ENCODER_ETC1S,
    sourceAbs,
    outputAbs,
    "--quality",
    String(quality),
    "--compression",
    String(compression),
    "--rdo-threshold",
    String(rdoThreshold),
    "--jobs",
    jobs,
  ]);
}

async function convertDesktop(sourceAbs, desktopAbs, tempBaseName, model) {
  const ktxOnlyDesktopAbs = resolve(tempDir, `${tempBaseName}.desktop.ktx.glb`);
  const desktopEncoder = getVariantEncoder(model, "desktop");

  let dracoSource = ktxOnlyDesktopAbs;
  if (skipKTX) {
    if (!existsSync(desktopAbs)) {
      throw new Error(
        `[optimize-models] ASSETS_SKIP_KTX=1 requires existing desktop asset: ${desktopAbs}`,
      );
    }
    if (glbHasDracoCompression(desktopAbs)) {
      console.log(
        `[optimize-models] Skipping draco desktop pass for ${tempBaseName} (already draco-compressed)`,
      );
      return;
    }
    dracoSource = desktopAbs;
    console.log(
      `[optimize-models] Skipping ${desktopEncoder} desktop pass for ${tempBaseName}`,
    );
  } else {
    const preparedSource = await prepareForKTX2(sourceAbs, `${tempBaseName}.desktop`);
    runTextureEncode(model, "desktop", preparedSource, ktxOnlyDesktopAbs);
  }

  runGLTFTransform([
    "draco",
    dracoSource,
    desktopAbs,
    "--method",
    "edgebreaker",
    "--encode-speed",
    "6",
    "--decode-speed",
    "6",
  ]);
}

async function convertMobile(sourceAbs, mobileAbs, mobileMaxSize, tempBaseName, model) {
  const resizedAbs = resolve(tempDir, `${tempBaseName}.resized.glb`);
  const ktxOnlyMobileAbs = resolve(tempDir, `${tempBaseName}.mobile.ktx.glb`);
  const mobileEncoder = getVariantEncoder(model, "mobile");

  let dracoSource = ktxOnlyMobileAbs;
  if (skipKTX) {
    if (!existsSync(mobileAbs)) {
      throw new Error(
        `[optimize-models] ASSETS_SKIP_KTX=1 requires existing mobile asset: ${mobileAbs}`,
      );
    }
    if (glbHasDracoCompression(mobileAbs)) {
      console.log(
        `[optimize-models] Skipping draco mobile pass for ${tempBaseName} (already draco-compressed)`,
      );
      return;
    }
    dracoSource = mobileAbs;
    console.log(
      `[optimize-models] Skipping resize+${mobileEncoder} mobile pass for ${tempBaseName}`,
    );
  } else {
    runGLTFTransform([
      "resize",
      sourceAbs,
      resizedAbs,
      "--width",
      String(mobileMaxSize),
      "--height",
      String(mobileMaxSize),
    ]);

    const preparedResized = await prepareForKTX2(resizedAbs, `${tempBaseName}.mobile`);

    runTextureEncode(model, "mobile", preparedResized, ktxOnlyMobileAbs);
  }

  runGLTFTransform([
    "draco",
    dracoSource,
    mobileAbs,
    "--method",
    "edgebreaker",
    "--encode-speed",
    "6",
    "--decode-speed",
    "6",
  ]);
}

async function optimize() {
  tempDir = mkdtempSync(join(tmpdir(), "frost-optimize-"));
  const models =
    includeIds.size === 0
      ? MODELS
      : MODELS.filter((model) => includeIds.has(model.id));

  if (includeIds.size > 0 && models.length !== includeIds.size) {
    const unknownIds = [...includeIds].filter(
      (id) => !MODELS.some((model) => model.id === id),
    );
    throw new Error(
      `[optimize-models] Unknown ASSETS_INCLUDE_IDS entries: ${unknownIds.join(", ")}`,
    );
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    toolchain: {
      gltfTransform: statSync(gltfTransformCli).mtime.toISOString(),
      ktxBinDir,
    },
    assets: [],
    totals: {
      sourceBytes: 0,
      desktopBytes: 0,
      mobileBytes: 0,
    },
  };

  for (const model of models) {
    const sourceAbs = resolve(root, model.source);
    const desktopAbs = resolve(root, model.desktop);
    const mobileAbs = model.mobile ? resolve(root, model.mobile) : null;

    ensureParent(desktopAbs);
    if (mobileAbs) ensureParent(mobileAbs);

    await convertDesktop(sourceAbs, desktopAbs, model.id, model);
    if (mobileAbs && model.mobileMaxSize) {
      await convertMobile(sourceAbs, mobileAbs, model.mobileMaxSize, model.id, model);
    } else if (mobileAbs) {
      copyFileSync(desktopAbs, mobileAbs);
    }

    const sourceBytes = statSync(sourceAbs).size;
    const desktopBytes = statSync(desktopAbs).size;
    const mobileBytes = mobileAbs ? statSync(mobileAbs).size : desktopBytes;

    summary.assets.push({
      id: model.id,
      source: model.source,
      desktop: model.desktop,
      mobile: model.mobile || model.desktop,
      desktopTextureEncoder: getVariantEncoder(model, "desktop"),
      mobileTextureEncoder: getVariantEncoder(model, "mobile"),
      sourceBytes,
      desktopBytes,
      mobileBytes,
      sourceMB: toMB(sourceBytes),
      desktopMB: toMB(desktopBytes),
      mobileMB: toMB(mobileBytes),
      desktopSavingsPct: Number(
        (((sourceBytes - desktopBytes) / sourceBytes) * 100).toFixed(2),
      ),
      mobileSavingsPct: Number(
        (((sourceBytes - mobileBytes) / sourceBytes) * 100).toFixed(2),
      ),
    });

    summary.totals.sourceBytes += sourceBytes;
    summary.totals.desktopBytes += desktopBytes;
    summary.totals.mobileBytes += mobileBytes;

    console.log(
      `[optimize-models] ${model.id}: ${toMB(sourceBytes)} MB -> ${toMB(desktopBytes)} MB (desktop), ${toMB(mobileBytes)} MB (mobile)`,
    );
  }

  summary.totals.sourceMB = toMB(summary.totals.sourceBytes);
  summary.totals.desktopMB = toMB(summary.totals.desktopBytes);
  summary.totals.mobileMB = toMB(summary.totals.mobileBytes);
  summary.totals.desktopSavingsPct = Number(
    (
      ((summary.totals.sourceBytes - summary.totals.desktopBytes) /
        summary.totals.sourceBytes) *
      100
    ).toFixed(2),
  );
  summary.totals.mobileSavingsPct = Number(
    (
      ((summary.totals.sourceBytes - summary.totals.mobileBytes) /
        summary.totals.sourceBytes) *
      100
    ).toFixed(2),
  );

  const manifestPath = resolve(root, "public/models/optimized/manifest.json");
  writeFileSync(manifestPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  rmSync(tempDir, { recursive: true, force: true });

  console.log(`[optimize-models] Wrote summary: ${manifestPath}`);
  console.log(`[optimize-models] Total: ${summary.totals.sourceMB} MB -> ${summary.totals.desktopMB} MB (desktop), ${summary.totals.mobileMB} MB (mobile)`);
}

optimize().catch((error) => {
  console.error("[optimize-models] Failed:", error);
  process.exit(1);
});
