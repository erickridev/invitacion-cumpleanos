CREATE TABLE IF NOT EXISTS familias (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    nombre_familia VARCHAR(150) NOT NULL,
    token_invitacion CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado_asistencia ENUM('confirmado', 'pendiente', 'no_asistira') NOT NULL DEFAULT 'pendiente'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sesiones (
    sid VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    data MEDIUMTEXT NOT NULL,
    expires_at BIGINT UNSIGNED NOT NULL,
    INDEX sesiones_expiracion (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
