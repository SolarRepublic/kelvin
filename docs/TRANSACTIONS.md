# Transactions (Durability)

Due to how the backing storage interface works (i.e., to be compatible with both `localStorage` and `chrome.storage.local`) each write is asynchronous and only 1 entry can be guaranteed, Kelvin cannot guarantee atomicity the same way that transactional database typically do. 

Instead, each write to the _data_ portion of the database creates a new immutable bucket before updating the database metadata, and eventually pruning dead/dangling buckets. With this design, a 'transaction' can be interrupted at any point (e.g., the connection could be terminated) and the database can still recover.

Let's walk through an example to demonstrate how Kelvin prevents interruptions from damaging the database.

> Note: the following example keys and values are for demonstration only and do not reflect the actual storage formats & mechanics.

1. Database contains 1 bucket having key "_bucket_1a" which contains 1 `Fruit` item `{name: 'apple', color: 'red'}`
2. Receives request to add another `Fruit` item: `{name: 'banana', color: 'yellow'}`
3. Exclusive, thread-safe write lock obtained to database
4. **WRITE**: A new bucket having key "_bucket_1b" containing `{name: 'apple', color: 'red'}, {name: 'banana', color: 'yellow'}` gets written to storage
   1. If connection is lost at this point, there will be a dangling "_bucket_1b". The update did not complete, but the database is not corrupted
5. **WRITE**: Database metadata about the new bucket gets written to storage
   1. If connection is lost at this point, there will be a dangling "_bucket_1a". The update completed, and Kelvin will remove the dangling bucket next time the database is opened.
6. **WRITE**: Old bucket having key "_bucket_1a" is deleted. Database has reached stasis.
7. Write lock to database is released
