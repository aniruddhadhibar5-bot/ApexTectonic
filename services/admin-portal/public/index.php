<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'GET' || $_SERVER['REQUEST_URI'] !== '/health') {
    http_response_code(404);
    echo json_encode(['error' => 'not_found'], JSON_THROW_ON_ERROR);
    exit;
}

echo json_encode(
    ['status' => 'scaffold_only', 'public_reporting_enabled' => false],
    JSON_THROW_ON_ERROR
);
