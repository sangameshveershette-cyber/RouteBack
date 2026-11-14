import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { MongooseModels } from './mongooseModels.ts';
import type { CollectionName, CollectionSchemaMap } from '../types.ts';

const ALL_COLLECTIONS: CollectionName[] = [
  'users',
  'drivers',
  'customers',
  'vehicleOwners',
  'vehicles',
  'driverAssignments',
  'returnTrips',
  'shipmentRequests',
  'matches',
  'bookings',
  'notifications',
  'reviews',
  'payments',
  'tripTracking',
];

type StoreState = {
  [K in CollectionName]: CollectionSchemaMap[K][];
};

const DB_FILE_PATH = path.resolve(process.cwd(), 'data', 'routeback_db.json');

function generateObjectId(): string {
  return crypto.randomBytes(12).toString('hex');
}

function normalizeDoc<T>(doc: unknown): T {
  if (!doc || typeof doc !== 'object') return doc as T;
  const raw = doc as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k === '__v') continue;
    if (v instanceof mongoose.Types.ObjectId) {
      out[k] = v.toString();
    } else if (v instanceof Date) {
      out[k] = v.toISOString();
    } else if (Array.isArray(v)) {
      out[k] = v.map((item) =>
        item instanceof mongoose.Types.ObjectId
          ? item.toString()
          : item instanceof Date
            ? item.toISOString()
            : item && typeof item === 'object'
              ? normalizeDoc(item)
              : item
      );
    } else if (v && typeof v === 'object' && '_bsontype' in (v as Record<string, unknown>)) {
      out[k] = String(v);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

function matchesFilter(doc: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  for (const [key, expected] of Object.entries(filter)) {
    if (key === '$or' && Array.isArray(expected)) {
      const anyMatched = expected.some((sub) =>
        matchesFilter(doc, sub as Record<string, unknown>)
      );
      if (!anyMatched) return false;
      continue;
    }
    const actual = doc[key];
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      const ops = expected as Record<string, unknown>;
      if ('$in' in ops && Array.isArray(ops.$in)) {
        if (!ops.$in.map(String).includes(String(actual))) return false;
        continue;
      }
      if ('$ne' in ops) {
        if (String(actual) === String(ops.$ne)) return false;
        continue;
      }
      if ('$gte' in ops && Number(actual) < Number(ops.$gte)) return false;
      if ('$lte' in ops && Number(actual) > Number(ops.$lte)) return false;
      continue;
    }
    if (expected === null) {
      if (actual !== null && actual !== undefined) return false;
      continue;
    }
    if (String(actual ?? '') !== String(expected)) return false;
  }
  return true;
}

class RouteBackDatabase {
  private mode: 'mongodb' | 'file_adapter' = 'file_adapter';
  private store: StoreState;
  private initialized = false;

  constructor() {
    this.store = this.createEmptyStore();
  }

  private createEmptyStore(): StoreState {
    return {
      users: [],
      drivers: [],
      customers: [],
      vehicleOwners: [],
      vehicles: [],
      driverAssignments: [],
      returnTrips: [],
      shipmentRequests: [],
      matches: [],
      bookings: [],
      notifications: [],
      reviews: [],
      payments: [],
      tripTracking: [],
    };
  }

  private loadFromDisk(): void {
    try {
      const dir = path.dirname(DB_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (fs.existsSync(DB_FILE_PATH)) {
        const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<StoreState>;
        const empty = this.createEmptyStore();
        for (const col of ALL_COLLECTIONS) {
          if (Array.isArray(parsed[col])) {
            (empty[col] as unknown[]) = parsed[col] as unknown[];
          }
        }
        this.store = empty;
      } else {
        this.saveToDisk();
      }
    } catch (err) {
      console.error('[RouteBack DB] Error loading file adapter store:', err);
      this.store = this.createEmptyStore();
    }
  }

  private saveToDisk(): void {
    try {
      const dir = path.dirname(DB_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tempPath = `${DB_FILE_PATH}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.store, null, 2), 'utf-8');
      fs.renameSync(tempPath, DB_FILE_PATH);
    } catch (err) {
      console.error('[RouteBack DB] Error saving file adapter store:', err);
    }
  }

  async connect(): Promise<'mongodb' | 'file_adapter'> {
    if (this.initialized) return this.mode;
    const mongoUri = process.env.MONGODB_URI;
    if (mongoUri && !mongoUri.includes('MY_')) {
      try {
        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2500 });
        this.mode = 'mongodb';
        this.initialized = true;
        console.log('[RouteBack DB] Connected to MongoDB via Mongoose.');
        return this.mode;
      } catch (err) {
        console.warn(
          '[RouteBack DB] MongoDB unreachable in current runtime, activating persistent Mongo-compatible adapter:',
          err instanceof Error ? err.message : String(err)
        );
      }
    } else {
      console.log(
        '[RouteBack DB] MONGODB_URI not configured for live cluster; using persistent Mongo-compatible 14-collection adapter at data/routeback_db.json.'
      );
    }

    this.mode = 'file_adapter';
    this.loadFromDisk();
    this.initialized = true;
    return this.mode;
  }

  getMode(): 'mongodb' | 'file_adapter' {
    return this.mode;
  }

  async count<K extends CollectionName>(
    collection: K,
    filter: Record<string, unknown> = {}
  ): Promise<number> {
    if (this.mode === 'mongodb') {
      const model = MongooseModels[collection] as mongoose.Model<unknown>;
      return model.countDocuments(filter);
    }
    return this.store[collection].filter((d) =>
      matchesFilter(d as unknown as Record<string, unknown>, filter)
    ).length;
  }

  async find<K extends CollectionName>(
    collection: K,
    filter: Record<string, unknown> = {},
    options?: { sortBy?: string; sortDir?: 'asc' | 'desc'; limit?: number }
  ): Promise<CollectionSchemaMap[K][]> {
    if (this.mode === 'mongodb') {
      const model = MongooseModels[collection] as mongoose.Model<unknown>;
      let query = model.find(filter);
      if (options?.sortBy) {
        query = query.sort({ [options.sortBy]: options.sortDir === 'asc' ? 1 : -1 });
      }
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      const docs = await query.lean();
      return docs.map((d) => normalizeDoc<CollectionSchemaMap[K]>(d));
    }

    let results = this.store[collection]
      .filter((d) => matchesFilter(d as unknown as Record<string, unknown>, filter))
      .map((d) => structuredClone(d));

    if (options?.sortBy) {
      const field = options.sortBy;
      const dir = options.sortDir === 'asc' ? 1 : -1;
      results.sort((a, b) => {
        const av = (a as unknown as Record<string, unknown>)[field];
        const bv = (b as unknown as Record<string, unknown>)[field];
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
        return String(av ?? '').localeCompare(String(bv ?? '')) * dir;
      });
    }
    if (options?.limit) {
      results = results.slice(0, options.limit);
    }
    return results;
  }

  async findOne<K extends CollectionName>(
    collection: K,
    filter: Record<string, unknown>
  ): Promise<CollectionSchemaMap[K] | null> {
    if (this.mode === 'mongodb') {
      const model = MongooseModels[collection] as mongoose.Model<unknown>;
      const doc = await model.findOne(filter).lean();
      return doc ? normalizeDoc<CollectionSchemaMap[K]>(doc) : null;
    }
    const found = this.store[collection].find((d) =>
      matchesFilter(d as unknown as Record<string, unknown>, filter)
    );
    return found ? structuredClone(found) : null;
  }

  async findById<K extends CollectionName>(
    collection: K,
    id: string
  ): Promise<CollectionSchemaMap[K] | null> {
    if (!id) return null;
    return this.findOne(collection, { _id: id });
  }

  async insertOne<K extends CollectionName>(
    collection: K,
    data: Omit<CollectionSchemaMap[K], '_id' | 'createdAt' | 'updatedAt'> & { _id?: string }
  ): Promise<CollectionSchemaMap[K]> {
    if (this.mode === 'mongodb') {
      const model = MongooseModels[collection] as mongoose.Model<unknown>;
      const created = await model.create(data);
      return normalizeDoc<CollectionSchemaMap[K]>(created.toObject());
    }
    const now = new Date().toISOString();
    const doc = {
      ...structuredClone(data),
      _id: data._id || generateObjectId(),
      createdAt: now,
      updatedAt: now,
    } as CollectionSchemaMap[K];
    this.store[collection].push(doc);
    this.saveToDisk();
    return structuredClone(doc);
  }

  async updateById<K extends CollectionName>(
    collection: K,
    id: string,
    updates: Partial<CollectionSchemaMap[K]>
  ): Promise<CollectionSchemaMap[K] | null> {
    if (this.mode === 'mongodb') {
      const model = MongooseModels[collection] as mongoose.Model<unknown>;
      const updated = await model.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean();
      return updated ? normalizeDoc<CollectionSchemaMap[K]>(updated) : null;
    }
    const idx = this.store[collection].findIndex((d) => d._id === id);
    if (idx === -1) return null;
    const now = new Date().toISOString();
    const next = {
      ...this.store[collection][idx],
      ...structuredClone(updates),
      _id: id,
      updatedAt: now,
    } as CollectionSchemaMap[K];
    this.store[collection][idx] = next;
    this.saveToDisk();
    return structuredClone(next);
  }

  async updateMany<K extends CollectionName>(
    collection: K,
    filter: Record<string, unknown>,
    updates: Partial<CollectionSchemaMap[K]>
  ): Promise<number> {
    if (this.mode === 'mongodb') {
      const model = MongooseModels[collection] as mongoose.Model<unknown>;
      const res = await model.updateMany(filter, { $set: updates });
      return res.modifiedCount;
    }
    let count = 0;
    const now = new Date().toISOString();
    const current = this.store[collection] as unknown as Array<Record<string, unknown> & { _id: string }>;
    const updated = current.map((d) => {
      if (matchesFilter(d, filter)) {
        count++;
        return { ...d, ...structuredClone(updates), updatedAt: now };
      }
      return d;
    });
    (this.store as unknown as Record<string, unknown>)[collection] = updated;
    if (count > 0) this.saveToDisk();
    return count;
  }

  async deleteById<K extends CollectionName>(collection: K, id: string): Promise<boolean> {
    if (this.mode === 'mongodb') {
      const model = MongooseModels[collection] as mongoose.Model<unknown>;
      const res = await model.findByIdAndDelete(id);
      return Boolean(res);
    }
    const current = this.store[collection] as unknown as Array<{ _id: string }>;
    const before = current.length;
    const next = current.filter((d) => d._id !== id);
    (this.store as unknown as Record<string, unknown>)[collection] = next;
    const deleted = next.length < before;
    if (deleted) this.saveToDisk();
    return deleted;
  }

  async deleteMany<K extends CollectionName>(
    collection: K,
    filter: Record<string, unknown>
  ): Promise<number> {
    if (this.mode === 'mongodb') {
      const model = MongooseModels[collection] as mongoose.Model<unknown>;
      const res = await model.deleteMany(filter);
      return res.deletedCount ?? 0;
    }
    const current = this.store[collection] as unknown as Array<Record<string, unknown>>;
    const before = current.length;
    const next = current.filter((d) => !matchesFilter(d, filter));
    (this.store as unknown as Record<string, unknown>)[collection] = next;
    const deleted = before - next.length;
    if (deleted > 0) this.saveToDisk();
    return deleted;
  }
}

export const db = new RouteBackDatabase();
export { generateObjectId };
