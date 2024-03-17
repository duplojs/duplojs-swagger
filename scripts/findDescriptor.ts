import {AbstractRoute, Checker, CutStep, Duplose, MergeAbstractRoute, Process, Route, zod} from "@duplojs/duplojs";
import {duploFindManyDesc} from "@duplojs/editor-tools";
import {generateSchema} from "@anatine/zod-openapi";
import {SwaggerDescriptor, SwaggerIgnoreInheritDescriptor, SwaggerParameter} from "./descriptors";

export const typeSwaggerParameter: Record<string, string> = {
	query: "query",
	params: "path",
	headers: "headers",
};

export function findDescriptor(
	duplose: Route | Process | AbstractRoute | MergeAbstractRoute | Checker,
	descriptors: any[]
){
	if(duplose instanceof Duplose){
		if(
			(
				duplose instanceof Route ||
				duplose instanceof AbstractRoute
			) && 
			duplose.subAbstractRoute &&
			duploFindManyDesc(duplose, v => v instanceof SwaggerIgnoreInheritDescriptor, "abstract") === null
		){
			findDescriptor(duplose.subAbstractRoute.parent, descriptors);
		}

		if(duplose.extracted.body){
			//@ts-ignore
			descriptors.push(new SwaggerParameter({
				...generateSchema(
					duplose.extracted.body instanceof zod.ZodType
						? duplose.extracted.body
						: zod.object(duplose.extracted.body as Record<string, zod.ZodType>)
				),
				in: "body",
				name: "",
			}));
		}

		Object.entries(duplose.extracted)
		.filter(([key]) => key !== "body")
		.forEach(([key, value]) => {
			if(value instanceof zod.ZodType) return;

			Object.entries(value ?? {})
			.forEach(([name, zodSchema]) => {
				//@ts-ignore
				descriptors.push(new SwaggerParameter({
					...generateSchema(zodSchema),
					in: typeSwaggerParameter[key] as any,
					name,
				}));
			});
		});
		
		duplose.steps.forEach((step, index) => {
			if(step instanceof CutStep) return;

			const descStep = duplose.descs.find((v: any) => v.index === index);

			if(descStep && descStep.descStep.find(v => v instanceof SwaggerIgnoreInheritDescriptor)) return;

			findDescriptor(step.parent, descriptors);
		});
	}
	else if(duplose instanceof MergeAbstractRoute){
		duplose.subAbstractRoutes.forEach(sub => findDescriptor(sub.parent, descriptors));
	}

	const descs: SwaggerDescriptor[] = duploFindManyDesc(duplose, () => true) || [];
	descriptors.push(...descs);
}
