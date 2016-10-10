<?php

use Illuminate\Database\Schema\Blueprint;

class CreateWorkoutsTable extends Migration
{
    public function up()
    {
        $this->schemaBuilder->create('workouts', function (Blueprint $table) {
            $table->increments('id');
            $table->integer('workout_template_id')->unsigned();
            $table->date('performed');
            $table
                ->foreign('workout_template_id')
                ->references('id')
                ->on('workout_templates')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->timestamps();
        });
    }

    public function down()
    {
        $this->schemaBuilder->disableForeignKeyConstraints();
        $this->schemaBuilder->drop('workouts');
        $this->schemaBuilder->enableForeignKeyConstraints();
    }
}
