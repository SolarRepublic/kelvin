import {__UNDEFINED, defer, type Dict, type Promisable} from '@blake.regalia/belt';

export type SimpleLockManager = {
	query(): Promise<LockManagerSnapshot>;
	request<w_return>(
		si_lock: string,
		gc_req: LockOptions,
		fk_use: (y_lock: Lock | null) => Promisable<w_return>
	): Promise<w_return>;
};

type HeldLock = {
	info: LockInfo;
};

type PendingLock = {
	info: LockInfo;
	execute: () => Promise<void>;
};

export class SingleThreadedLockManager implements SimpleLockManager {
	protected _h_held: Dict<HeldLock> = {};
	protected _h_pending: Dict<PendingLock[]> = {};

	query(): Promise<LockManagerSnapshot> {
		return Promise.resolve({
			held: Object.values(this._h_held).map(g => g.info),
			pending: Object.values(this._h_pending).flatMap(a => a.map(g => g.info)),
		});
	}

	async request<w_return>(
		si_name: string,
		gc_req: LockOptions,
		fk_use: (y_lock: Lock | null) => Promisable<w_return>
	): Promise<w_return> {
		const {
			mode: si_mode='exclusive',
			signal: d_signal,
			steal: b_steal=false,
			ifAvailable: b_if_available=false,
		} = gc_req;

		// create lock object
		const g_lock: Lock = {
			mode: si_mode,
			name: si_name,
		};

		// prep lock info
		const g_info: LockInfo = {
			clientId: '',
			...g_lock,
		};

		// create executor
		const f_execute = async() => {
			// add to held
			this._h_held[si_name] = {
				info: g_info,
			};

			// use
			try {
				return await fk_use(g_lock);
			}
			finally {
				// delete held lock
				delete this._h_held[si_name];

				// another lock is pending; execute it
				const a_pending = this._h_pending[si_name];
				if(a_pending?.length) {
					void a_pending.shift()!.execute();
				}
			}
		};

		// lock already held
		if(this._h_held[si_name]) {
			// 
			const [dp_free, fk_exec] = defer();

			// add to pending
			(this._h_pending[si_name] ||= []).push({
				info: g_info,
				execute: async() => {
					try {
						fk_exec(await f_execute());
					}
					catch(e_reject) {
						fk_exec(__UNDEFINED, e_reject as Error);
					}
				},
			});

			return dp_free;
		}
		// lock is free
		else {
			return await f_execute();
		}
	}
}
