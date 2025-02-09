# Connections

Kelvin is m thread-safe, multi-tenant database management system. It allows multiple simultaneous connections from different threads to the same database (as well as, conversely, multiple connections to different databases from the same thread).

Since each database is encrypted with its own security, there are three distinct steps needed to start interacting with its contents: connecting, unlocking, and opening.

**Connecting** configures the client to point at the target database, while **unlocking** deals with setting up the keys to manage encryption/decryption of its contents. Since the keys are temporarily persisted in the SessionStore, unlocking only needs to be done once (on one thread) per session -- whereas connecting must be performed on each thread. Consequently, connecting to a database which is already unlocked by another thread that is using the same SessionStore means that the newly connected thread does not need to perform unlocking.

The process for connecting is as follows:

1. User requests to connect to a specific database (identified by a string)
2. Vault checks its sessionStore
2. Vault acquires a global lock on its SessionStore
3. 
