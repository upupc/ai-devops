#!/bin/bash

# AI DevOps Agent 停止脚本

APP_NAME="ai-devops"
PID_FILE=".data/${APP_NAME}.pid"

# 停止应用
stop_app() {
    if [ ! -f "$PID_FILE" ]; then
        echo "PID 文件不存在，应用可能未在运行"

        # 尝试通过端口查找进程
        local port=${PORT:-3000}
        local pid=$(lsof -ti:$port 2>/dev/null)
        if [ -n "$pid" ]; then
            echo "检测到端口 $port 上有进程运行，PID: $pid"
            read -p "是否停止该进程？(y/n): " confirm
            if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
                kill "$pid" 2>/dev/null
                echo "进程已停止"
            fi
        fi
        return 0
    fi

    local pid=$(cat "$PID_FILE")

    if ! kill -0 "$pid" 2>/dev/null; then
        echo "进程 $pid 已不存在"
        rm -f "$PID_FILE"
        return 0
    fi

    echo "正在停止 ${APP_NAME}，PID: $pid..."

    # 先尝试优雅停止
    kill "$pid" 2>/dev/null

    # 等待进程退出
    local count=0
    while kill -0 "$pid" 2>/dev/null; do
        if [ $count -ge 10 ]; then
            echo "进程未响应，强制终止..."
            kill -9 "$pid" 2>/dev/null
            break
        fi
        sleep 1
        count=$((count + 1))
    done

    rm -f "$PID_FILE"
    echo "应用已停止"
}

# 显示帮助信息
show_help() {
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -f, --force     强制停止 (SIGKILL)"
    echo "  -h, --help      显示帮助信息"
}

# 强制停止
force_stop() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        echo "强制停止进程 $pid..."
        kill -9 "$pid" 2>/dev/null
        rm -f "$PID_FILE"
        echo "进程已强制终止"
    else
        echo "PID 文件不存在"
    fi
}

# 主逻辑
main() {
    while [ $# -gt 0 ]; do
        case "$1" in
            -f|--force)
                force_stop
                exit 0
                ;;
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

    stop_app
}

main "$@"
