import z from "zod";

export const CreateSpaceBody = z.object({    
    name: z.string(),
    width: z.number(),
    height: z.number() || z.null(),  // ? means optional
    thumbnail: z.string() || z.null(),
    creatorId: z.string(),
}
)

