import { MigrationInterface, QueryRunner } from "typeorm";

export class Baseline1795305307365 implements MigrationInterface {
    name = 'Baseline1795305307365'

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (await queryRunner.hasTable('users')) return;

        await queryRunner.query(`CREATE TABLE "saved_apis" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "name" character varying NOT NULL, "open_api_url" character varying NOT NULL, "api_base_url" character varying, "default_settings" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_197862658b7f7ffb7204c7f5a5c" UNIQUE ("user_id", "name"), CONSTRAINT "PK_bbff586cf7162cb0217d6435f7f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "custom_rules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "name" character varying NOT NULL, "rules_config" jsonb NOT NULL, "severity_weights" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_da1696c596d2113a018fedf782d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "password_hash" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "evaluations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid, "openapi_url" character varying NOT NULL, "api_base_url" character varying, "targets" jsonb, "request_settings" jsonb, "performance_results" jsonb, "evaluation_type" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'PENDING', "spectral_result" jsonb, "security_result" jsonb, "final_score" double precision, "steps" jsonb, "pillar_scores" jsonb, "scoring" jsonb, "score_breakdown" jsonb, "error_message" character varying, "error_code" character varying, "started_at" TIMESTAMP WITH TIME ZONE, "finished_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f683b433eba0e6dae7e19b29e29" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_13b2fe20c63264b529b340c29d" ON "evaluations"  ("user_id", "created_at") `);
        await queryRunner.query(`CREATE TABLE "evaluation_jobs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "evaluation_id" uuid NOT NULL, "type" character varying NOT NULL, "payload" jsonb NOT NULL, "status" character varying NOT NULL DEFAULT 'PENDING', "attempts" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_25d723fd13ed62b277c1166f106" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_evaluation_jobs_poll" ON "evaluation_jobs"  ("type", "status", "created_at") `);
        await queryRunner.query(`ALTER TABLE "saved_apis" ADD CONSTRAINT "FK_144935b25d17209f075314d4219" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "custom_rules" ADD CONSTRAINT "FK_6240d0775d7ac5bf02f10369e9e" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "evaluations" ADD CONSTRAINT "FK_3d371b1ebe55ca4c60cbf66fa0e" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "evaluations" DROP CONSTRAINT "FK_3d371b1ebe55ca4c60cbf66fa0e"`);
        await queryRunner.query(`ALTER TABLE "custom_rules" DROP CONSTRAINT "FK_6240d0775d7ac5bf02f10369e9e"`);
        await queryRunner.query(`ALTER TABLE "saved_apis" DROP CONSTRAINT "FK_144935b25d17209f075314d4219"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_evaluation_jobs_poll"`);
        await queryRunner.query(`DROP TABLE "evaluation_jobs"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_13b2fe20c63264b529b340c29d"`);
        await queryRunner.query(`DROP TABLE "evaluations"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "custom_rules"`);
        await queryRunner.query(`DROP TABLE "saved_apis"`);
    }

}
