Thesea re the manual steps to deploying a site that I use

Obviously you will need access to a CMS instance, doesn't really matter which one. With every instance you do get three. I basically use them as three separate instances and put different things on them as they all have their own API keys etc.

The second thing that you need is a code base. This is what the deploy app builds for you and some of the deployment steps. Setting up locally obviously is going to be manual. The idea is to not have to realy customize anything especially code. An SA would ideally have everything they need to do a custom demo easily.

Here the steps manually:

1. branch off the main or latest tag in the git repo in this case [opti-baseline verticals branch](https://github.com/marvoey/opti-baseline/tree/verticals)
2. Then deploy this to vercel.
3. once deployed to vercel add a subdomain and attach to the branch just deployed
4. add environment variables specifically for the branch deployment
