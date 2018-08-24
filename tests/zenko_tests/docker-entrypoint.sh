#!/bin/sh

EXIT_STATUS="0"

enter_and_run() {
    local old_cwd="$(pwd)"
    cd "$1"
    sh -c "$2"
    if [ "$?" -ne "0" ]; then
        EXIT_STATUS="1"
        echo "$2 have failed"
    fi
    cd "$old_cwd"
}

# Setup our environment
python3 create_buckets.py

# Run the tests
enter_and_run node_tests "npm_chain.sh test_crr test_api test_crr_pause_resume test_location_quota"
enter_and_run python_tests "./run.sh $PYTHON_ARGS"

exit "$EXIT_STATUS"
