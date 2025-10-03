// entities/Entity.ts
export type EntityKind = "bunny" | "fox" | "wolf" | "bear" | "grass";;

export type SerializedEntity = {
  id: number;
  kind?: EntityKind;   // old data may not have kind
  dead: boolean;
  z: number;
  liftPx: number;
};

export type BaseInit = {
  id: number;
  dead: boolean;
  z: number;
  liftPx: number;
};

export abstract class Entity {
  id: number;
  dead: boolean;
  z: number;
  liftPx: number;
  abstract kind: EntityKind;

  constructor(init: BaseInit) {
    this.id = init.id;
    this.dead = init.dead;
    this.z = init.z;
    this.liftPx = init.liftPx;
  }

  /** Return a shallowly-updated clone, preserving subclass */
  withPatch(patch: Partial<Pick<Entity, "dead" | "z" | "liftPx">>): AnyEntity {
    const next: BaseInit = {
      id: this.id,
      dead: patch.dead ?? this.dead,
      z: patch.z ?? this.z,
      liftPx: patch.liftPx ?? this.liftPx,
    };
    // Preserve runtime subclass by calling its (init: BaseInit) ctor
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctor = this.constructor as any;
    return new Ctor(next);
  }

  toJSON(): SerializedEntity {
    return {
      id: this.id,
      dead: this.dead,
      z: this.z,
      liftPx: this.liftPx,
      kind: this.kind,
    };
  }

  static fromJSON(obj: SerializedEntity): AnyEntity {
    const kind = (obj.kind ?? "bunny") as EntityKind; // migrate old data
    const base: BaseInit = {
      id: Number(obj.id),
      dead: !!obj.dead,
      z: Number(obj.z),
      liftPx: Number(obj.liftPx),
    };
    switch (kind) {
      case "bunny": return new BunnyEntity(base);
      case "grass": return new GrassEntity(base);
      case "fox":   return new FoxEntity(base);
      case "wolf":  return new WolfEntity(base);
      default:      return new BunnyEntity(base);
    }
  }
}

/* ---- concrete entities ---- */
export class BunnyEntity extends Entity {
  kind: EntityKind = "bunny";
//   constructor(init: BaseInit) { super(init); }
}

export class GrassEntity extends Entity {
  kind: EntityKind = "grass";
//   constructor(init: BaseInit) { super(init); }
}

export class FoxEntity extends Entity {
  kind: EntityKind = "fox";
//   constructor(init: BaseInit) { super(init); }
}

export class WolfEntity extends Entity {
  kind: EntityKind = "wolf";
//   constructor(init: BaseInit) { super(init); } // <-- was EntityInit / args list
}

// 2) BearEntity class (mirrors your other concrete entities)
export class BearEntity extends Entity {
  kind: EntityKind = "bear";
//   constructor(init: BaseInit) {
//     super(init);
//   }
}

/* ---- unions & helpers ---- */
export type AnyEntity = BunnyEntity | GrassEntity | FoxEntity | WolfEntity;

export function serializeEntities(list: AnyEntity[]): SerializedEntity[] {
  return list.map((e) => e.toJSON());
}

export function deserializeEntities(list: SerializedEntity[]): AnyEntity[] {
  return list.map((s) => Entity.fromJSON(s));
}
