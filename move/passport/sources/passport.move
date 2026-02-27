module passport::passport {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::dynamic_field as df;
    use std::string::{String};
    use sui::event;

    /// Levels of the passport
    const LEVEL_BRONZE: u8 = 0;
    const LEVEL_SILVER: u8 = 1;
    const LEVEL_GOLD: u8 = 2;

    /// Thresholds for evolution
    const SILVER_THRESHOLD: u64 = 5;
    const GOLD_THRESHOLD: u64 = 15;

    struct Passport has key, store {
        id: UID,
        owner_name: String,
        level: u8,
        stamp_count: u64,
        description: String,
    }

    struct Stamp has store, copy, drop {
        location_id: u64,
        location_name: String,
        timestamp: u64,
    }

    struct PassportMinted has copy, drop {
        passport_id: ID,
        owner: address,
    }

    struct StampAdded has copy, drop {
        passport_id: ID,
        location_id: u64,
        new_count: u64,
        new_level: u8,
    }

    public entry fun mint(
        name: String,
        recipient: address,
        ctx: &mut TxContext
    ) {
        let id = object::new(ctx);
        let passport_id = object::uid_to_inner(&id);

        let passport = Passport {
            id,
            owner_name: name,
            level: LEVEL_BRONZE,
            stamp_count: 0,
            description: std::string::utf8(b"Paspor Jelajah Sinjai - Bronze"),
        };

        transfer::public_transfer(passport, recipient);

        event::emit(PassportMinted {
            passport_id,
            owner: recipient,
        });
    }

    public entry fun add_stamp(
        passport: &mut Passport,
        location_id: u64,
        location_name: String,
        timestamp: u64,
        _ctx: &mut TxContext
    ) {
        let stamp = Stamp {
            location_id,
            location_name,
            timestamp,
        };

        // Use location_id as key for dynamic field
        df::add(&mut passport.id, location_id, stamp);
        
        passport.stamp_count = passport.stamp_count + 1;

        // Evolution logic
        if (passport.stamp_count >= GOLD_THRESHOLD) {
            passport.level = LEVEL_GOLD;
            passport.description = std::string::utf8(b"Paspor Jelajah Sinjai - Gold");
        } else if (passport.stamp_count >= SILVER_THRESHOLD) {
            passport.level = LEVEL_SILVER;
            passport.description = std::string::utf8(b"Paspor Jelajah Sinjai - Silver");
        };

        event::emit(StampAdded {
            passport_id: object::uid_to_inner(&passport.id),
            location_id,
            new_count: passport.stamp_count,
            new_level: passport.level,
        });
    }
}
