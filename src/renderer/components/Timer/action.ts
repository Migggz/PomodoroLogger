import { createActionCreator, createReducer } from 'deox';
import { Dispatch } from 'redux';
import { addSession } from '../../monitor/sessionManager';
import { actions as boardActions } from '../Kanban/Board/action';
import { actions as kanbanActions } from '../Kanban/action';
import { actions as historyActions } from '../History/action';
import { promisify } from 'util';
import dbs, { getNameFromBoardId } from '../../dbs';
import { PomodoroRecord } from '../../monitor/type';
import { workers } from '../../workers';
import { DEBUG_TIME_SCALE } from '../../../config';

export const LONG_BREAK_INTERVAL = 4;

export interface Setting {
    focusDuration: number;
    restDuration: number;
    longBreakDuration: number;
    monitorInterval: number;
    screenShotInterval?: number;
    startOnBoot: boolean;
}

export interface TimerState extends Setting {
    targetTime?: number;
    leftTime?: number;
    isFocusing: boolean;
    isRunning: boolean;
    boardId?: string;
    iBreak: number; // i-th break session, if i can be divided by 4, start longer break

    currentTab: string;
}

export const defaultState: TimerState = {
    targetTime: undefined,
    focusDuration: 25 * 60,
    restDuration: 5 * 60,
    iBreak: 0,
    longBreakDuration: 15 * 60,
    isRunning: false,
    isFocusing: true,
    startOnBoot: false,

    monitorInterval: 1000,
    screenShotInterval: undefined,
    currentTab: 'timer'
};

export const startTimer = createActionCreator('[Timer]START_TIMER');
export const stopTimer = createActionCreator('[Timer]STOP_TIMER');
export const continueTimer = createActionCreator('[Timer]CONTINUE_TIMER');
export const clearTimer = createActionCreator('[Timer]CLEAR_TIMER');
export const timerFinished = createActionCreator('[Timer]TIMER_FINISHED');
export const extendCurrentSession = createActionCreator(
    '[Timer]EXTEND_CURRENT_SESSION',
    resolve => (time: number) => resolve(time)
);
export const setLongBreakDuration = createActionCreator(
    '[Timer]SET_LONG_BREAK',
    resolve => (longBreakDuration: number) => resolve({ longBreakDuration })
);
export const setStartOnBoot = createActionCreator(
    '[Timer]SWITCH_START_ON_BOOT',
    resolve => (check: boolean) => resolve(check)
);
export const setFocusDuration = createActionCreator(
    '[Timer]SET_FOCUS_DURATION',
    resolve => (duration: number) => resolve(duration)
);
export const setRestDuration = createActionCreator(
    '[Timer]SET_REST_DURATION',
    resolve => (duration: number) => resolve(duration)
);
export const setBoardId = createActionCreator(
    '[Timer]SET_BOARD_ID',
    resolve => (boardId?: string) => resolve({ boardId })
);
export const setMonitorInterval = createActionCreator(
    '[Timer]SET_MONITOR_INTERVAL',
    resolve => (interval: number) => resolve(interval)
);
export const setScreenShotInterval = createActionCreator(
    '[Timer]SET_SCREEN_SHOT_INTERVAL',
    resolve => (interval?: number) => resolve(interval)
);
export const switchFocusRestMode = createActionCreator('[Timer]SWITCH_FOCUS_MODE');
export const changeAppTab = createActionCreator('[App]CHANGE_APP_TAB', resolve => (tab: string) =>
    resolve(tab)
);

const throwError = (err: Error) => {
    if (err) {
        throw err;
    }
};
export const actions = {
    stopTimer,
    continueTimer,
    clearTimer,
    startTimer,
    switchFocusRestMode,
    setBoardId,
    changeAppTab,
    extendCurrentSession,
    fetchSettings: () => async (dispatch: Dispatch) => {
        const settings: Partial<Setting> = await promisify(
            dbs.settingDB.findOne.bind(dbs.settingDB)
        )({ name: 'setting' });
        if (settings == null) {
            return;
        }

        const settingKeywords = [
            ['focusDuration', setFocusDuration],
            ['restDuration', setRestDuration],
            ['monitorInterval', setMonitorInterval],
            ['screenShotInterval', setScreenShotInterval],
            ['startOnBoot', setStartOnBoot],
            ['longBreakDuration', setLongBreakDuration]
        ];
        for (const key of settingKeywords) {
            if (key[0] in settings) {
                // @ts-ignore
                const action = key[1](settings[key[0]]);
                dispatch(action);
            }
        }
    },
    setFocusDuration: (focusDuration: number) => async (dispatch: Dispatch) => {
        dispatch(setFocusDuration(focusDuration));
        dbs.settingDB.update(
            { name: 'setting' },
            { $set: { focusDuration } },
            { upsert: true },
            throwError
        );
    },
    setRestDuration: (restDuration: number) => async (dispatch: Dispatch) => {
        dispatch(setRestDuration(restDuration));
        dbs.settingDB.update(
            { name: 'setting' },
            { $set: { restDuration } },
            { upsert: true },
            throwError
        );
    },
    setLongBreakDuration: (longBreakDuration: number) => async (dispatch: Dispatch) => {
        dispatch(setLongBreakDuration(longBreakDuration));
        dbs.settingDB.update(
            { name: 'setting' },
            { $set: { longBreakDuration } },
            { upsert: true },
            throwError
        );
    },
    setStartOnBoot: (check: boolean) => async (dispatch: Dispatch) => {
        dispatch(setStartOnBoot(check));
        dbs.settingDB.update(
            { name: 'setting' },
            { $set: { startOnBoot: check } },
            { upsert: true },
            throwError
        );
    },
    setMonitorInterval: (monitorInterval: number) => async (dispatch: Dispatch) => {
        dispatch(setMonitorInterval(monitorInterval));
        dbs.settingDB.update(
            { name: 'setting' },
            { $set: { monitorInterval } },
            { upsert: true },
            throwError
        );
    },
    setScreenShotInterval: (screenShotInterval?: number) => async (dispatch: Dispatch) => {
        dispatch(setScreenShotInterval(screenShotInterval));
        dbs.settingDB.update(
            { name: 'setting' },
            { $set: { screenShotInterval } },
            { upsert: true },
            throwError
        );
    },
    timerFinished: (
        sessionData?: PomodoroRecord,
        cardIds: string[] = [],
        boardId?: string | undefined
    ) => async (dispatch: Dispatch) => {
        dispatch(timerFinished());
        dispatch(historyActions.setExpiringKey(new Date().toString()));
        if (sessionData) {
            await addSession(sessionData).catch(err => console.error(err));
            if (boardId !== undefined) {
                await boardActions.onTimerFinished(
                    boardId,
                    sessionData._id,
                    sessionData.spentTimeInHour,
                    cardIds
                )(dispatch);
            }
        }
    },
    inferProject: (sessionData: PomodoroRecord) => async (dispatch: Dispatch) => {
        // Predict session's project
        const newProjectId = (await workers.knn.predict(sessionData).catch(err => {
            console.error('predicting error', err);
            return undefined;
        })) as string | undefined;

        if (newProjectId !== undefined) {
            const newProject = await getNameFromBoardId(newProjectId);
            console.log('predicted type', newProject);
            dispatch(setBoardId(newProject));
        }
    },
    switchToKanban: (kanbanId: string) => (dispatch: Dispatch) => {
        dispatch(actions.changeAppTab('kanban'));
        kanbanActions.setChosenBoardId(kanbanId)(dispatch);
    }
};

export type TimerActionTypes = { [key in keyof typeof actions]: typeof actions[key] };
export const reducer = createReducer<TimerState, any>(defaultState, handle => [
    handle(startTimer, (state: TimerState) => {
        const duration: number = state.isFocusing
            ? state.focusDuration
            : state.iBreak % LONG_BREAK_INTERVAL === 0
            ? state.longBreakDuration
            : state.restDuration;
        const now = new Date().getTime();
        if (process.env.NODE_ENV !== 'production') {
            return {
                ...state,
                isRunning: true,
                targetTime: now + (duration * 1000) / DEBUG_TIME_SCALE
            };
        }

        return { ...state, isRunning: true, targetTime: now + duration * 1000 };
    }),

    handle(stopTimer, state => ({
        ...state,
        isRunning: false,
        leftTime: state.targetTime ? state.targetTime - new Date().getTime() : undefined
    })),

    handle(continueTimer, state => ({
        ...state,
        isRunning: true,
        targetTime: state.leftTime ? new Date().getTime() + state.leftTime : state.targetTime
    })),
    handle(clearTimer, state => ({
        ...state,
        leftTime: undefined,
        isRunning: false,
        targetTime: undefined
    })),
    handle(timerFinished, (state: TimerState) => {
        return {
            ...state,
            isRunning: false,
            targetTime: undefined,
            isFocusing: !state.isFocusing,
            iBreak: state.iBreak + (state.isFocusing ? 1 : 0),
            leftTime: undefined
        };
    }),

    handle(setFocusDuration, (state, { payload }) =>
        // Project: persistence
        ({ ...state, focusDuration: payload })
    ),

    handle(setRestDuration, (state, { payload }) =>
        // Project: persistence
        ({ ...state, restDuration: payload })
    ),

    handle(setMonitorInterval, (state, { payload }) => ({ ...state, monitorInterval: payload })),

    handle(setScreenShotInterval, (state, { payload }) => ({
        ...state,
        screenShotInterval: payload
    })),

    handle(switchFocusRestMode, state => ({
        ...state,
        isFocusing: !state.isFocusing,
        leftTime: undefined,
        targetTime: undefined,
        isRunning: false
    })),

    handle(setBoardId, (state, { payload: { boardId } }) => ({ ...state, boardId })),
    handle(changeAppTab, (state, { payload }) => ({ ...state, currentTab: payload })),
    handle(setStartOnBoot, (state, { payload }) => ({
        ...state,
        startOnBoot: payload
    })),
    handle(setLongBreakDuration, (state, { payload: { longBreakDuration } }) => ({
        ...state,
        longBreakDuration
    })),
    handle(extendCurrentSession, (state, { payload }) => ({
        ...state,
        targetTime: new Date().getTime() + payload * 1000,
        isFocusing: true,
        isRunning: true
    }))
]);
