import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export const baseDir =
    process.env.APPDATA ||
    (process.platform === 'darwin'
        ? process.env.HOME + 'Library/Preferences'
        : process.env.HOME + '/.local/share');

const dbDir = process.env.NODE_ENV !== 'test' ? 'db' : '__test__db';
export const dbBaseDir =
    process.env.NODE_ENV === 'production' ? join(baseDir, dbDir) : './' + dbDir;

if (!existsSync(dbBaseDir)) {
    mkdirSync(dbBaseDir);
}

export const dbPaths = {
    projectDBPath: join(dbBaseDir, 'projects.nedb'),
    sessionDBPath: join(dbBaseDir, 'session.nedb'),
    settingDBPath: join(dbBaseDir, 'setting.nedb')
};
