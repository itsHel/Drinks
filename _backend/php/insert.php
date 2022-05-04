<?php
    require "database.php";

    $type = $_GET["type"];
    $created = $_GET["created"];

    $cmd = "INSERT INTO drinks (type, created) VALUES('".$type."', '".$created."')";

    if($err = Db::query($cmd)){
        Db::dbError($err, $cmd, __FILE__, __LINE__);
    }

    echo "1";
    exit();