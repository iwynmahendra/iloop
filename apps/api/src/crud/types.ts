export type FieldType = 'uuid' | 'string' | 'char' | 'int' | 'bigint' | 'decimal' | 'bool' | 'date' | 'datetime' | 'json' | 'time' | 'array' | 'enum';
export interface FieldDef { n: string; t: FieldType; opt: boolean; hasDefault: boolean; values?: string[]; max?: number }
export interface SetDef { path: 'images' | 'amenities'; kind: 'image' | 'join'; delegate: string; parentField: string; childField: string; relation: string; refDelegate: string }
export interface ResourceDef {
  name: string; delegate: string; table: string; group: 'shared' | 'hotel' | 'trips' | 'transport' | 'club';
  path: string; tenant: boolean; fields: FieldDef[]; search: string[];
  refs: { field: string; delegate: string }[]; sets: SetDef[]; sharedRead: boolean; keyField: string | null;
}
