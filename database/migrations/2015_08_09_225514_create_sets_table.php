<?php

use Illuminate\Database\Schema\Blueprint;

class CreateSetsTable extends Migration
{
    public function up()
    {
        $this->schemaBuilder->create('sets', function (Blueprint $table) {
            $table->increments('id');
            $table->integer('exercise_id')->unsigned();
            $table
                ->integer('workout_id')
                ->unsigned()
                ->nullable();
            $table
                ->integer('weight')
                ->unsigned()
                ->nullable();
            $table->integer('reps')->unsigned();
            $table->timestamps();
            $table
                ->foreign('exercise_id')
                ->references('id')
                ->on('exercises')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table
                ->foreign('workout_id')
                ->references('id')
                ->on('workouts')
                ->onDelete('cascade')
                ->onUpdate('cascade');
        });
    }

    public function down()
    {
        $this->schemaBuilder->disableForeignKeyConstraints();
        $this->schemaBuilder->drop('sets');
        $this->schemaBuilder->enableForeignKeyConstraints();
    }
}
