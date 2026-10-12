import {
    Entity, PrimaryGeneratedColumn, Column,
    CreateDateColumn, UpdateDateColumn, OneToMany,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { SavedApi } from './SavedApi.js';
import { CustomRule } from './CustomRule.js';

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', unique: true })
    email!: string;

    @Column({ name: 'password_hash', type: 'varchar' })
    passwordHash!: string;

    @OneToMany(() => SavedApi, (api) => api.user)
    savedApis!: Relation<SavedApi>[];

    @OneToMany(() => CustomRule, (rule) => rule.user)
    customRules!: Relation<CustomRule>[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
