'use client'

import React, { createContext, useContext, useReducer, ReactNode } from 'react'
import { Session, Message, Workspace, FileNode, OpenFile } from '@/types'

/**
 * 应用状态接口
 */
interface AppState {
    sessions: Session[]
    currentSessionId: string | null
    messages: Message[]
    isLoading: boolean
    workspace: Workspace | null
    fileTree: FileNode | null
    openFiles: OpenFile[]
    activeFilePath: string | null
}

/**
 * 状态操作类型
 */
type AppAction =
    | { type: 'SET_SESSIONS'; payload: Session[] }
    | { type: 'ADD_SESSION'; payload: Session }
    | { type: 'DELETE_SESSION'; payload: string }
    | { type: 'SET_CURRENT_SESSION'; payload: string | null }
    | { type: 'SET_MESSAGES'; payload: Message[] }
    | { type: 'ADD_MESSAGE'; payload: Message }
    | { type: 'UPDATE_MESSAGE'; payload: { id: string; content: string } }
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'SET_WORKSPACE'; payload: Workspace | null }
    | { type: 'SET_FILE_TREE'; payload: FileNode | null }
    | { type: 'OPEN_FILE'; payload: OpenFile }
    | { type: 'CLOSE_FILE'; payload: string }
    | { type: 'SET_ACTIVE_FILE'; payload: string | null }
    | { type: 'UPDATE_FILE_CONTENT'; payload: { path: string; content: string } }
    | { type: 'MARK_FILE_SAVED'; payload: string }

/**
 * 初始状态
 */
const initialState: AppState = {
    sessions: [],
    currentSessionId: null,
    messages: [],
    isLoading: false,
    workspace: null,
    fileTree: null,
    openFiles: [],
    activeFilePath: null,
}

/**
 * 状态 reducer
 */
function appReducer(state: AppState, action: AppAction): AppState {
    switch (action.type) {
        case 'SET_SESSIONS':
            return { ...state, sessions: action.payload }

        case 'ADD_SESSION':
            return { ...state, sessions: [...state.sessions, action.payload] }

        case 'DELETE_SESSION':
            return {
                ...state,
                sessions: state.sessions.filter(s => s.id !== action.payload),
                currentSessionId: state.currentSessionId === action.payload ? null : state.currentSessionId,
            }

        case 'SET_CURRENT_SESSION':
            return { ...state, currentSessionId: action.payload }

        case 'SET_MESSAGES':
            return { ...state, messages: action.payload }

        case 'ADD_MESSAGE':
            return { ...state, messages: [...state.messages, action.payload] }

        case 'UPDATE_MESSAGE':
            return {
                ...state,
                messages: state.messages.map(m =>
                    m.id === action.payload.id ? { ...m, content: m.content + action.payload.content } : m
                ),
            }

        case 'SET_LOADING':
            return { ...state, isLoading: action.payload }

        case 'SET_WORKSPACE':
            return { ...state, workspace: action.payload }

        case 'SET_FILE_TREE':
            return { ...state, fileTree: action.payload }

        case 'OPEN_FILE': {
            const existingIndex = state.openFiles.findIndex(f => f.path === action.payload.path)
            if (existingIndex >= 0) {
                return { ...state, activeFilePath: action.payload.path }
            }
            return {
                ...state,
                openFiles: [...state.openFiles, action.payload],
                activeFilePath: action.payload.path,
            }
        }

        case 'CLOSE_FILE': {
            const newOpenFiles = state.openFiles.filter(f => f.path !== action.payload)
            let newActivePath = state.activeFilePath
            if (state.activeFilePath === action.payload) {
                newActivePath = newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1].path : null
            }
            return { ...state, openFiles: newOpenFiles, activeFilePath: newActivePath }
        }

        case 'SET_ACTIVE_FILE':
            return { ...state, activeFilePath: action.payload }

        case 'UPDATE_FILE_CONTENT':
            return {
                ...state,
                openFiles: state.openFiles.map(f =>
                    f.path === action.payload.path
                        ? { ...f, content: action.payload.content, modified: true }
                        : f
                ),
            }

        case 'MARK_FILE_SAVED':
            return {
                ...state,
                openFiles: state.openFiles.map(f =>
                    f.path === action.payload ? { ...f, modified: false } : f
                ),
            }

        default:
            return state
    }
}

/**
 * Context 类型
 */
interface AppContextType {
    state: AppState
    dispatch: React.Dispatch<AppAction>
}

const AppContext = createContext<AppContextType | undefined>(undefined)

/**
 * App Provider 组件
 */
export function AppProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(appReducer, initialState)

    return (
        <AppContext.Provider value={{ state, dispatch }}>
            {children}
        </AppContext.Provider>
    )
}

/**
 * 使用 App 状态的 Hook
 */
export function useAppState() {
    const context = useContext(AppContext)
    if (context === undefined) {
        throw new Error('useAppState must be used within an AppProvider')
    }
    return context
}
