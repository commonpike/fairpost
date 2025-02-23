# Fairpost: Basic structure

The singleton `Fairpost.ts` is the internal API of Fairpost.
It is an executioner of commands, executed by an `Operator` 
optionally on a `User`. An interface using Fairpost only has 
to speak with this singleton.



## Roles, permissions

The callee of those commands constructs the operator and the
optional user; the operator is assigned one or more 'roles'
that will later give it 'permissions' to execute the command.
Fairpost is the only place where these permissions are checked.

## Class structure

- User
 - Feed
   - feed.sources[]
     - Source (data, files)
 - Platforms[]
   - Platform
     - platform.posts[]
       - Post (data, files)

Posts are prepared from a Source for each Platform.

The singleton dives into this class structure to execute
the command. For example, `get-post` executes something like
```
const source = user.getFeed().getSource(sourceId); 
const platform = user.getPlatform(platformId);
const post = source.getPost(platform);
```

## DTOs

All relevant models have associated 'mappers' which
can return or receive a 'DTO' of an instance of that model. 
These DTOs are returned (or received) by the API. The contents
of the DTO is also determined by the operators permissions.
To support this, all mappers have a FieldMapping that 
describes each field of the DTO in detail.

## Logging

The Fairpost singleton has its own log, but each User
also has a log. Within the user, the log level can be
changed to better debug issues for the user without
affecting the global log.

## Paths

Within a User, Feed or Platform, paths are noted as relative 
to the users homedir. This includes the path of a source.
This way, you can swap, copy or rename users without having 
to edit any data.

Within a Source or Post, paths are noted as relative to the 
source. This way, you can swap, copy or rename sources or
posts without having to edit any data.
