#!/bin/bash

# AI DevOps Agent 启动脚本 (后台模式)

set -e

APP_NAME="ai-devops"
PID_FILE=".data/${APP_NAME}.pid"
LOG_FILE=".data/${APP_NAME}.log"
PORT=${PORT:-3000}

# 确保数据目录存在
mkdir -p .data

# 检查是否已在运行
check_running() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            echo "应用已在运行中，PID: $pid"
            return 0
        else
            rm -f "$PID_FILE"
        fi
    fi
    return 1
}

# 后台启动
start_background() {
    echo "启动 ${APP_NAME}..."
    echo "端口: ${PORT}"
    echo "日志文件: ${LOG_FILE}"

    nohup npm run start > "$LOG_FILE" 2>&1 &
    local pid=$!
    echo $pid > "$PID_FILE"

    # 等待几秒检查是否启动成功
    sleep 3
    if kill -0 "$pid" 2>/dev/null; then
        echo "应用启动成功，PID: $pid"
        echo "查看日志: tail -f ${LOG_FILE}"
    else
        echo "应用启动失败，请查看日志: ${LOG_FILE}"
        rm -f "$PID_FILE"
        exit 1
    fi
}

# 显示帮助信息
show_help() {
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -h, --help      显示帮助信息"
    echo ""
    echo "环境变量:"
    echo "  PORT            服务端口 (默认: 3000)"
}

# 主逻辑
main() {
    while [ $# -gt 0 ]; do
        case "$1" in
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                echo "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done

    # 检查是否已在运行
    if check_running; then
        exit 1
    fi

    # 检查是否已安装依赖
    if [ ! -d "node_modules" ]; then
        echo "未检测到依赖，先执行安装..."
        npm install
    fi

    # 检查是否已构建
    if [ ! -d ".next" ]; then
        echo "未检测到构建产物，先执行构建..."
        npm run build
    fi

    start_background
}

main "$@"
