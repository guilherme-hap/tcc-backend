import {
    Entity, PrimaryGeneratedColumn, Column,
    CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from './User.js';

@Entity('custom_rules')
export class CustomRule {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @ManyToOne(() => User, (user) => user.customRules, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user!: User;

    @Column({ name: 'user_id', type: 'uuid' })
    userId!: string;

    @Column({ type: 'varchar' })
    name!: string;

    @Column({ name: 'rules_config', type: 'jsonb' })
    rulesConfig!: Record<string, boolean>;

    @Column({ name: 'severity_weights', type: 'jsonb', nullable: true })
    severityWeights!: Record<string, number> | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
