<?php

use Illuminate\Database\Schema\Blueprint;

class CreateExerciseTemplatesTable extends Migration
{
    public function up()
    {
        $this->schemaBuilder->create('exercise_templates', function (Blueprint $table) {
            $table->increments('id');
            $table->integer('workout_template_id')->unsigned();
            $table->integer('exercise_id')->unsigned();
            $table->integer('sets_min')->unsigned();
            $table->integer('sets_max')->unsigned();
            $table->integer('reps_min')->unsigned();
            $table->integer('reps_max')->unsigned();
            $table
                ->integer('rest_min')
                ->unsigned()
                ->nullable();
            $table
                ->integer('rest_max')
                ->unsigned()
                ->nullable();
            $table
                ->integer('display_order')
                ->unsigned()
                ->default(0);
            $table->timestamps();
            $table
                ->foreign('workout_template_id')
                ->references('id')
                ->on('workout_templates')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table
                ->foreign('exercise_id')
                ->references('id')
                ->on('exercises')
                ->onDelete('cascade')
                ->onUpdate('cascade');
        });
    }

    public function down()
    {
        $this->schemaBuilder->disableForeignKeyConstraints();
        $this->schemaBuilder->drop('exercise_templates');
        $this->schemaBuilder->enableForeignKeyConstraints();
    }
}
