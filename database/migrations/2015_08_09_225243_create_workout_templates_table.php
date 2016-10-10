<?php

use Illuminate\Database\Schema\Blueprint;

class CreateWorkoutTemplatesTable extends Migration
{
    public function up()
    {
        $this->schemaBuilder->create('workout_templates', function (Blueprint $table) {
            $table->increments('id');
            $table->integer('user_id')->unsigned();
            $table->string('name');
            $table->integer('display_order')->default(0);
            $table->unique(['name', 'user_id']);
            $table
                ->foreign('user_id')
                ->references('id')->on('users')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->timestamps();
        });
    }

    public function down()
    {
        $this->schemaBuilder->disableForeignKeyConstraints();
        $this->schemaBuilder->drop('workout_templates');
        $this->schemaBuilder->enableForeignKeyConstraints();
    }
}
