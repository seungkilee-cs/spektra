#!/usr/bin/env bash

# Check if the current directory is a git repository
if [ -d .git ] || git rev-parse --git-dir > /dev/null 2>&1; then
    echo "This is a git repository. The script will run."

    # Get the current timestamp
    timestamp=$(date +"%Y-%m-%d_%H_%M_%S")

    # Check if there are any changes that have not been staged
    if [ -z "$(git status --porcelain)" ]; then
        echo "No new changes to commit. Exiting."
        exit 1
    fi

    # Prompt the user for a commit message
    read -p "Enter commit message: " commit_message

    # Set the commit message, appending the timestamp if empty
    if [ -z "$commit_message" ]; then
        commit_message="autodeploy-$timestamp"
    else
        commit_message="$commit_message-$timestamp"
    fi

    # OPTIONAL - Run custom script
    npm run build && npm run deploy

    # Add all changes to git
    git add .

    # Commit the changes
    git commit -m "$commit_message"

    # Create the branch name
    branch_name="autodeploy-$timestamp"

    # Create a new branch and switch to it
    git checkout -b $branch_name

    # Push the new branch to the remote repository
    git push origin $branch_name

    # Switch back to the master branch
    git checkout master

    # Merge the new branch into master
    git merge $branch_name

    # Push the changes to the master branch at the remote repository
    git push origin master

    # Delete the local branch
    git branch -d $branch_name

    # Delete the branch from the remote repository
    git push origin --delete $branch_name

else
    echo "This is not a git repository. The script will not run."
fi
