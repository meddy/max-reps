<?php

use Illuminate\Database\Schema\Blueprint;

class CreateExercisesTable extends Migration
{
    public function up()
    {
        $this->schemaBuilder->create('exercises', function (Blueprint $table) {
            $table->increments('id');
            $table
                ->integer('user_id')
                ->unsigned()
                ->nullable();
            $table->string('name');
            $table->timestamps();
            $table->unique(['name', 'user_id']);
            $table
                ->foreign('user_id')
                ->references('id')->on('users')
                ->onDelete('cascade')
                ->onUpdate('cascade');
        });
    }

    public function down()
    {
        $this->schemaBuilder->disableForeignKeyConstraints();
        $this->schemaBuilder->drop('exercises');
        $this->schemaBuilder->enableForeignKeyConstraints();
    }
}
