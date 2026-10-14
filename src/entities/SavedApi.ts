import {
    Entity, PrimaryGeneratedColumn, Column,
    CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { User } from './User.js';
import type { LoadTestOptionsInput } from '../schemas/loadTestOptions.schema.js';

@Entity('saved_apis')
@Unique(['userId', 'openApiUrl'])
export class SavedApi {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @ManyToOne(() => User, (user) => user.savedApis, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user!: Relation<User>;

    @Column({ name: 'user_id', type: 'uuid' })
    userId!: string;

    @Column({ type: 'varchar' })
    name!: string;

    @Column({ name: 'open_api_url', type: 'varchar' })
    openApiUrl!: string;

    @Column({ name: 'api_base_url', type: 'varchar', nullable: true })
    apiBaseUrl!: string | null;

    @Column({ name: 'default_settings', type: 'jsonb', nullable: true })
    defaultSettings!: {
        rulesConfig?: Record<string, boolean>;
        loadTestOptions?: LoadTestOptionsInput;
    } | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
