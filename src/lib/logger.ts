import winston from 'winston';
import path from 'path';
import fs from 'fs';

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_DIR = process.env.LOG_DIR || '';

// 日志格式：时间戳 + 级别 + 消息
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} [${level.toUpperCase()}] ${message}${metaStr}`;
    })
);

// 控制台格式：带颜色
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} [${level}] ${message}${metaStr}`;
    })
);

// 创建 transports 数组
const transports: winston.transport[] = [
    new winston.transports.Console({
        format: consoleFormat
    })
];

// 如果配置了日志目录，添加文件传输
if (LOG_DIR) {
    const logDir = path.resolve(LOG_DIR);

    // 确保日志目录存在
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }

    // 普通日志文件
    transports.push(
        new winston.transports.File({
            filename: path.join(logDir, 'app.log'),
            format: logFormat,
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5
        })
    );

    // 错误日志文件
    transports.push(
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            format: logFormat,
            maxsize: 10 * 1024 * 1024,
            maxFiles: 5
        })
    );
}

// 创建 logger 实例
const logger = winston.createLogger({
    level: LOG_LEVEL,
    transports
});

// 为子模块创建带标签的 logger
export function createLogger(label: string): winston.Logger {
    return logger.child({ label });
}

export default logger;
