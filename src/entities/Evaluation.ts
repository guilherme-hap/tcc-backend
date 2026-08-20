import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('evaluations')
export class Evaluation {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar' })
    swaggerUrl!: string;

    @Column({ type: 'varchar', nullable: true })
    baseUrl!: string | null;

    @Column({ type: 'varchar', default: 'PENDING' })
    status!: string;

    @Column({ type: 'json', nullable: true })
    spectralResult!: any;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
