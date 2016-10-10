<?php

use Illuminate\Database\Connection;
use Illuminate\Database\Schema\Builder;
use \Illuminate\Database\Migrations\Migration as IlluminateMigration;

class Migration extends IlluminateMigration
{
    /** @var Builder */
    protected $schemaBuilder;

    /** @var Connection */
    protected $connection;

    public function __construct()
    {
        $this->connection = app()->make('db');
        $this->schemaBuilder = $this->connection->getSchemaBuilder();
    }
}
