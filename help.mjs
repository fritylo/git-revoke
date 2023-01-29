export function help() {
    console.log(`
================================================
Git command to revert merge commits without pain
================================================

Usage:
    revoke <merge_commit_hash>
    revoke 928e58ad
        
Before usage:
    Checkout branch with merge commit

How it works:
    1) Delete local branch of merge (if present)
    2) Delete remote branch of merge (if present)
    3) Revert merge commit
    4) Create copy of merge branch
    5) Cherry-pick merge changes to the copy
    6) Print suggestions for changes pushing

© fritylo 2023, license MIT
    `);
}
