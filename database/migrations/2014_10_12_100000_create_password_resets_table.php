<?php

use Illuminate\Database\Schema\Blueprint;

class CreatePasswordResetsTable extends Migration
{
    public function up()
    {
        $this->schemaBuilder->create('password_resets', function (Blueprint $table) {
            $table->string('email')->index();
            $table->string('token')->index();
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down()
    {
        $this->schemaBuilder->drop('password_resets');
    }
}
