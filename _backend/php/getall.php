<?php
    require "database.php";

    $cmd = "SELECT * FROM drinks";

    if(is_string($select = Db::select($cmd))){
        Db::dbError($select, $cmd, __FILE__, __LINE__);
    }

    echo json_encode($select);
    exit();