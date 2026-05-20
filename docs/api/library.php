<?php

declare(strict_types=1);

header("Content-Type: application/json; charset=utf-8");

$method = $_SERVER["REQUEST_METHOD"] ?? "GET";
$rootDir = dirname(__DIR__);
$dataFile = $rootDir . DIRECTORY_SEPARATOR . "data" . DIRECTORY_SEPARATOR . "library-resources.json";
$projectBasePath = rtrim(str_replace("\\", "/", dirname(__DIR__, 1) !== false ? dirname(dirname($_SERVER["SCRIPT_NAME"] ?? "/")) : "/project"), "/");

if ($method === "GET") {
    respondJson(loadLibraryCatalog($rootDir, $dataFile, $projectBasePath));
}

if ($method === "POST") {
    try {
        $resources = handleUpload($rootDir, $dataFile, $projectBasePath);
        respondJson($resources, 201);
    } catch (RuntimeException $exception) {
        respondJson(["error" => $exception->getMessage()], 400);
    }
}

respondJson(["error" => "Metodo nao suportado."], 405);

function handleUpload(string $rootDir, string $dataFile, string $projectBasePath): array
{
    $title = trim((string) ($_POST["title"] ?? ""));
    $type = trim((string) ($_POST["type"] ?? ""));
    $category = trim((string) ($_POST["category"] ?? ""));
    $description = trim((string) ($_POST["description"] ?? ""));
    $createdBy = trim((string) ($_POST["createdBy"] ?? "admin"));
    $file = $_FILES["file"] ?? null;

    if ($category === "" || mb_strtolower($category) === "todas") {
        throw new RuntimeException("Seleciona uma categoria valida.");
    }

    if (!is_array($file) || !isset($file["name"])) {
        throw new RuntimeException("Seleciona um ficheiro para enviar.");
    }

    $typeConfig = getTypeConfig($type);
    $targetDir = $rootDir . DIRECTORY_SEPARATOR . $typeConfig["directory"];
    if (!is_dir($targetDir) && !mkdir($targetDir, 0777, true) && !is_dir($targetDir)) {
        throw new RuntimeException("Nao foi possivel preparar a pasta de destino.");
    }

    $resources = loadResources($dataFile);
    $createdResources = [];
    $uploadedFiles = normalizeUploadedFiles($file);

    foreach ($uploadedFiles as $index => $uploadedFile) {
        $errorCode = (int) ($uploadedFile["error"] ?? UPLOAD_ERR_NO_FILE);
        if ($errorCode !== UPLOAD_ERR_OK) {
            throw new RuntimeException("Um dos ficheiros nao foi enviado corretamente.");
        }

        $originalName = (string) ($uploadedFile["name"] ?? "");
        $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
        if (!in_array($extension, $typeConfig["extensions"], true)) {
            throw new RuntimeException("Formato de ficheiro nao suportado para este tipo.");
        }

        $safeBaseName = slugify(pathinfo($originalName, PATHINFO_FILENAME));
        if ($safeBaseName === "") {
            $safeBaseName = $type . "-" . ($index + 1);
        }

        $finalName = date("Ymd-His") . "-" . $safeBaseName . "-" . substr(bin2hex(random_bytes(3)), 0, 6) . "." . $extension;
        $targetPath = $targetDir . DIRECTORY_SEPARATOR . $finalName;

        if (!move_uploaded_file((string) $uploadedFile["tmp_name"], $targetPath)) {
            throw new RuntimeException("Nao foi possivel guardar um dos ficheiros enviados.");
        }

        $createdResources[] = [
            "id" => "resource-" . bin2hex(random_bytes(6)),
            "title" => $title !== "" && count($uploadedFiles) === 1 ? $title : buildTitleFromFilename($originalName),
            "type" => $type,
            "category" => $category,
            "description" => $description,
            "url" => buildPublicFileUrl($projectBasePath, $typeConfig["directory"], $finalName),
            "filename" => $finalName,
            "createdAt" => round(microtime(true) * 1000),
            "createdBy" => $createdBy,
        ];
    }

    foreach (array_reverse($createdResources) as $resource) {
        array_unshift($resources, $resource);
    }

    saveResources($dataFile, $resources);

    return $createdResources;
}

function getTypeConfig(string $type): array
{
    $map = getTypeConfigMap();

    if (!isset($map[$type])) {
        throw new RuntimeException("Tipo de material invalido.");
    }

    return $map[$type];
}

function getTypeConfigMap(): array
{
    return [
        "pdf" => [
            "directory" => "pdfs",
            "extensions" => ["pdf"],
        ],
        "video" => [
            "directory" => "videos",
            "extensions" => ["mp4", "webm", "ogg", "mov", "m4v"],
        ],
        "summary" => [
            "directory" => "resumos",
            "extensions" => ["pdf", "doc", "docx", "txt", "rtf", "odt", "ppt", "pptx", "pps", "ppsx", "md", "csv", "xls", "xlsx", "canvas"],
        ],
    ];
}

function loadResources(string $dataFile): array
{
    if (!is_file($dataFile)) {
        return [];
    }

    $contents = file_get_contents($dataFile);
    if ($contents === false || trim($contents) === "") {
        return [];
    }

    $decoded = json_decode($contents, true);
    return is_array($decoded) ? $decoded : [];
}

function loadLibraryCatalog(string $rootDir, string $dataFile, string $projectBasePath): array
{
    $storedResources = loadResources($dataFile);
    $resourceIndex = [];

    foreach ($storedResources as $resource) {
        $resource = normalizeResourceUrl($resource, $projectBasePath);
        $key = buildResourceKey((string) ($resource["type"] ?? ""), (string) ($resource["filename"] ?? ""));
        if ($key !== null) {
            $resourceIndex[$key] = $resource;
        }
    }

    $catalog = [];
    foreach (getTypeConfigMap() as $type => $config) {
        $directory = $rootDir . DIRECTORY_SEPARATOR . $config["directory"];
        if (!is_dir($directory)) {
            continue;
        }

        $entries = scandir($directory);
        if (!is_array($entries)) {
            continue;
        }

        foreach ($entries as $entry) {
            if ($entry === "." || $entry === "..") {
                continue;
            }

            $fullPath = $directory . DIRECTORY_SEPARATOR . $entry;
            if (!is_file($fullPath)) {
                continue;
            }

            $extension = strtolower(pathinfo($entry, PATHINFO_EXTENSION));
            if (!in_array($extension, $config["extensions"], true)) {
                continue;
            }

            $key = buildResourceKey($type, $entry);
            $catalog[] = $resourceIndex[$key] ?? createAutoResource($type, $config["directory"], $entry, $fullPath, $projectBasePath);
            unset($resourceIndex[$key]);
        }
    }

    foreach ($storedResources as $resource) {
        $resource = normalizeResourceUrl($resource, $projectBasePath);
        $key = buildResourceKey((string) ($resource["type"] ?? ""), (string) ($resource["filename"] ?? ""));
        if ($key === null || isset($resourceIndex[$key])) {
            $catalog[] = $resource;
            if ($key !== null) {
                unset($resourceIndex[$key]);
            }
        }
    }

    usort($catalog, static function (array $left, array $right): int {
        return (int) ($right["createdAt"] ?? 0) <=> (int) ($left["createdAt"] ?? 0);
    });

    return $catalog;
}

function saveResources(string $dataFile, array $resources): void
{
    $encoded = json_encode($resources, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($encoded === false || file_put_contents($dataFile, $encoded) === false) {
        throw new RuntimeException("Nao foi possivel atualizar a biblioteca.");
    }
}

function slugify(string $value): string
{
    $value = iconv("UTF-8", "ASCII//TRANSLIT//IGNORE", $value) ?: $value;
    $value = strtolower($value);
    $value = preg_replace("/[^a-z0-9]+/", "-", $value) ?? "";
    return trim($value, "-");
}

function buildResourceKey(string $type, string $filename): ?string
{
    if ($type === "" || $filename === "") {
        return null;
    }

    return $type . "::" . $filename;
}

function createAutoResource(string $type, string $directory, string $filename, string $fullPath, string $projectBasePath): array
{
    return [
        "id" => "auto-" . md5($type . "::" . $filename),
        "title" => buildTitleFromFilename($filename),
        "type" => $type,
        "category" => $type === "summary" ? "Resumo Bernardo" : "Sem categoria",
        "description" => "Ficheiro detetado automaticamente na pasta do projeto.",
        "url" => buildPublicFileUrl($projectBasePath, $directory, $filename),
        "filename" => $filename,
        "createdAt" => is_file($fullPath) ? ((int) filemtime($fullPath) * 1000) : 0,
        "createdBy" => "sistema",
    ];
}

function normalizeUploadedFiles(array $file): array
{
    if (!is_array($file["name"])) {
        return [$file];
    }

    $normalized = [];
    foreach ($file["name"] as $index => $name) {
        $normalized[] = [
            "name" => $name,
            "type" => $file["type"][$index] ?? "",
            "tmp_name" => $file["tmp_name"][$index] ?? "",
            "error" => $file["error"][$index] ?? UPLOAD_ERR_NO_FILE,
            "size" => $file["size"][$index] ?? 0,
        ];
    }

    return $normalized;
}

function buildTitleFromFilename(string $filename): string
{
    $baseName = pathinfo($filename, PATHINFO_FILENAME);
    $baseName = str_replace(["-", "_"], " ", $baseName);
    $baseName = preg_replace("/\s+/", " ", $baseName) ?? $baseName;
    return trim($baseName) !== "" ? trim($baseName) : $filename;
}

function buildPublicFileUrl(string $projectBasePath, string $directory, string $filename): string
{
    $basePath = $projectBasePath !== "" ? $projectBasePath : "/project";
    return $basePath . "/" . $directory . "/" . rawurlencode($filename);
}

function normalizeResourceUrl(array $resource, string $projectBasePath): array
{
    $filename = (string) ($resource["filename"] ?? "");
    $type = (string) ($resource["type"] ?? "");
    if ($filename === "" || $type === "") {
        return $resource;
    }

    $config = getTypeConfigMap()[$type] ?? null;
    if ($config === null) {
        return $resource;
    }

    $resource["url"] = buildPublicFileUrl($projectBasePath, $config["directory"], $filename);
    return $resource;
}

function respondJson($payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}
