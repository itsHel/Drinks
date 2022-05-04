<?php

define("DB_SERVER", "");
define("DB_USERNAME", "");
define("DB_PASS", "");
define("DB_NAME", "");

Class Db
{
    // Returns false on success, string on error
    static function query($cmd){
        $conn = new mysqli(DB_SERVER, DB_USERNAME, DB_PASS, DB_NAME);

        if(!$conn->query($cmd)){
            $return = $conn->error;
        } else {
            $return = false;
        }

        $conn->close();

        return $return;
    }

    // Returns array of arrays on success, string on error
    static function select($cmd){
        $conn = new mysqli(DB_SERVER, DB_USERNAME, DB_PASS, DB_NAME);

        if(!$result = $conn->query($cmd))
            return("Query failed: ".$conn->error);

        $select = [];
        if($result->num_rows > 0){
            while($row = $result->fetch_assoc()){
                $select[] = $row;
            }
        }

        $conn->close();

        return $select;
    }

    static function dbError($err, $cmd, $function, $line){
        http_response_code(500);
        self::errorLog("db_log.txt", $err, $cmd, $function, $line);
        die("Database Error");
        die($err);
    }

    static function errorLog($file, $message, $cmd = "", $function = "", $line = ""){
        $file = fopen(__DIR__."/../error_log/".$file, "a+");

        if(!is_string($message))
            $message = var_export($message, true);
        $message .= "\n".$cmd;
        
        if($function && $line)
            $head = $function." ; Line: ".$line."\n";
        else if($function)
            $head = $function."\n";
        else if($line)
            $head = "Line: ".$line."\n";
        else
            $head = "";

        fwrite($file, "[".date('Y-m-d H:i:s')."]\n".$head.$message."\n\n");
    }

    static function createTable(){
        $conn = new mysqli(DB_SERVER, DB_USERNAME, DB_PASS, DB_NAME);
        
        $cmd =
            "CREATE TABLE IF NOT EXISTS drinks(
                id INT(10) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                type VARCHAR(255),
                created DATETIME,
            )";

        if(!$conn->query($cmd)){
            die("Query failed: ".$conn->error);
        }
    }
}